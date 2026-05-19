package ao.az.modtube.service;

import ao.az.modtube.domain.Video;
import ao.az.modtube.domain.VideoStatus;
import ao.az.modtube.metrics.ModTubeMetrics;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
public class TranscodingService {

    private static final long PROCESS_TIMEOUT_MINUTES = 180;

    // FFmpeg progress parsing patterns
    private static final Pattern DURATION_PATTERN =
            Pattern.compile("Duration:\\s+(\\d+):(\\d+):(\\d+\\.\\d+)");
    private static final Pattern TIME_PATTERN =
            Pattern.compile("time=(\\d+):(\\d+):(\\d+\\.\\d+)");

    private final VideoService videoService;
    private final ModTubeMetrics metrics;
    private final Path hlsDir;
    private final Path thumbnailDir;
    private final int segmentDuration;
    private final List<String> allowedQualities;
    private final ConcurrentHashMap<String, Process> activeProcesses = new ConcurrentHashMap<>();

    /** Human-readable stage exposed via GET /api/upload/status/{id} */
    private final ConcurrentHashMap<String, String> processingStages = new ConcurrentHashMap<>();

    /** Per-quality progress (0-100) per video, for detailed UI feedback */
    private final ConcurrentHashMap<String, ConcurrentHashMap<String, Integer>> qualityProgressMap =
            new ConcurrentHashMap<>();

    public String getProcessingStage(String videoId) {
        return processingStages.getOrDefault(videoId, "");
    }

    /** Returns a snapshot of per-quality progress for the given video (empty if not transcoding). */
    public Map<String, Integer> getQualityProgress(String videoId) {
        ConcurrentHashMap<String, Integer> m = qualityProgressMap.get(videoId);
        return m != null ? Map.copyOf(m) : Map.of();
    }

    /**
     * Kills all active FFmpeg processes for the given video.
     * Call before deleting a video to prevent FFmpeg from continuing to write to disk.
     */
    public void cancelTranscoding(String videoId) {
        String prefix = videoId + "_";
        activeProcesses.entrySet().removeIf(e -> {
            if (e.getKey().startsWith(prefix)) {
                Process p = e.getValue();
                if (p != null && p.isAlive()) {
                    p.destroyForcibly();
                    log.info("[Transcoding] Killed process {} for video={}", e.getKey(), videoId);
                }
                return true;
            }
            return false;
        });
        processingStages.put(videoId, "Cancelled");
        log.info("[Transcoding] Cancelled all processes for video={}", videoId);
    }

    /**
     * On startup, marks any video stuck in UPLOADING / UPLOADED / PROCESSING as FAILED.
     * These states indicate the server restarted before the operation could complete.
     */
    @PostConstruct
    public void recoverStuckTranscodings() {
        List<VideoStatus> stuck = List.of(VideoStatus.UPLOADING, VideoStatus.UPLOADED, VideoStatus.PROCESSING);
        List<Video> stuckVideos = videoService.getVideosByStatusIn(stuck);
        if (stuckVideos.isEmpty()) return;
        log.warn("[Startup] Found {} stuck videos — marking FAILED", stuckVideos.size());
        for (Video video : stuckVideos) {
            log.warn("[Startup] Recovering video={} status={}", video.getId(), video.getStatus());
            try {
                videoService.updateVideoStatus(video.getId(), VideoStatus.FAILED);
                processingStages.put(video.getId(), "Failed: Server restarted");
            } catch (Exception e) {
                log.error("[Startup] Failed to recover video={}: {}", video.getId(), e.getMessage());
            }
        }
        log.info("[Startup] Recovery complete for {} videos", stuckVideos.size());
    }

    public TranscodingService(VideoService videoService,
                              ModTubeMetrics metrics,
                              @Value("${modtube.storage.hls-dir}") String hlsDirPath,
                              @Value("${modtube.storage.thumbnail-dir}") String thumbnailDirPath,
                              @Value("${modtube.transcoding.segment-duration}") int segmentDuration,
                              @Value("${modtube.transcoding.qualities}") List<String> qualities) {
        this.videoService = videoService;
        this.metrics = metrics;
        this.hlsDir = Paths.get(hlsDirPath);
        this.thumbnailDir = Paths.get(thumbnailDirPath);
        this.segmentDuration = segmentDuration;
        this.allowedQualities = qualities;
    }

    @Async("videoProcessingExecutor")
    public void transcodeToHLS(String videoId, Path inputFile) {
        long startMs = System.currentTimeMillis();
        metrics.incrementActiveTranscodings();
        try {
            log.info("[Transcoding] ▶ Starting video={}", videoId);
            processingStages.put(videoId, "Starting");
            videoService.updateVideoStatus(videoId, VideoStatus.PROCESSING);
            videoService.updateProcessingProgress(videoId, 0);

            Path outputDir = hlsDir.resolve(videoId);
            Files.createDirectories(outputDir);

            // Stage 1: thumbnail (0 → 5%)
            processingStages.put(videoId, "Generating thumbnail");
            generateThumbnail(videoId, inputFile);
            videoService.updateProcessingProgress(videoId, 5);

            // Stage 2: probe (5%)
            processingStages.put(videoId, "Analysing video");
            VideoInfo info = getVideoInfo(inputFile);
            log.info("[Transcoding] video={} size={}x{} duration={}s",
                    videoId, info.width, info.height, info.durationSeconds);
            videoService.updateVideoMetadata(videoId, info.width, info.height,
                    info.durationSeconds, Files.size(inputFile));

            // Stage 3: per-quality transcoding (5 → 95%), qualities run in parallel
            List<QualityProfile> profiles = buildQualityProfiles(info);

            // Shared overall progress + per-quality progress for UI feedback
            AtomicInteger sharedProgress = new AtomicInteger(5);
            ConcurrentHashMap<String, Integer> qp = new ConcurrentHashMap<>();
            profiles.forEach(p -> qp.put(p.label, 0));
            qualityProgressMap.put(videoId, qp);

            processingStages.put(videoId, "Transcoding " + profiles.stream()
                .map(p -> p.label).reduce((a, b) -> a + "+" + b).orElse(""));

            // Run each quality in its own thread; report progress atomically
            List<CompletableFuture<Map.Entry<Integer, Boolean>>> futures = new ArrayList<>();
            for (int i = 0; i < profiles.size(); i++) {
                final QualityProfile profile = profiles.get(i);
                final int idx = i;
                futures.add(CompletableFuture.supplyAsync(() -> {
                    boolean ok = transcodeQuality(videoId, inputFile, outputDir, profile,
                            sharedProgress, qp);
                    return Map.entry(idx, ok);
                }));
            }

            // Collect results in profile order
            boolean[] results = new boolean[profiles.size()];
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
            for (CompletableFuture<Map.Entry<Integer, Boolean>> f : futures) {
                Map.Entry<Integer, Boolean> r = f.join();
                results[r.getKey()] = r.getValue();
            }
            qualityProgressMap.remove(videoId);

            StringBuilder masterPlaylist = new StringBuilder();
            masterPlaylist.append("#EXTM3U\n#EXT-X-VERSION:3\n");

            for (int i = 0; i < profiles.size(); i++) {
                if (!results[i]) {
                    log.error("[Transcoding] ✗ quality={} video={}", profiles.get(i).label, videoId);
                    continue;
                }
                QualityProfile profile = profiles.get(i);
                masterPlaylist.append("#EXT-X-STREAM-INF:BANDWIDTH=")
                        .append(profile.bandwidth)
                        .append(",RESOLUTION=")
                        .append(profile.width).append("x").append(profile.height)
                        .append("\n").append(profile.label).append("/playlist.m3u8\n");
                videoService.addQualityToVideo(videoId, profile.label);
            }

            // Stage 4: finalise (95 → 100%)
            processingStages.put(videoId, "Finalising");
            videoService.updateProcessingProgress(videoId, 95);
            Files.writeString(outputDir.resolve("master.m3u8"), masterPlaylist.toString());

            try { Files.deleteIfExists(inputFile); }
            catch (IOException e) { log.warn("[Transcoding] Could not delete original: {}", e.getMessage()); }

            videoService.updateProcessingProgress(videoId, 100);
            videoService.updateVideoStatus(videoId, VideoStatus.READY);
            processingStages.put(videoId, "Ready");
            log.info("[Transcoding] ✓ Done video={}", videoId);
            metrics.recordTranscodingSuccess();
            metrics.recordTranscodingDuration(System.currentTimeMillis() - startMs);
            System.gc();

        } catch (Exception e) {
            log.error("[Transcoding] ✗ ERROR video={}: {}", videoId, e.getMessage(), e);
            processingStages.put(videoId, "Failed: " + e.getMessage());
            metrics.recordTranscodingFailure();
            metrics.recordTranscodingDuration(System.currentTimeMillis() - startMs);
            try {
                videoService.updateVideoStatus(videoId, VideoStatus.FAILED);
                Files.deleteIfExists(inputFile);
            } catch (IOException ignored) {}
        } finally {
            metrics.decrementActiveTranscodings();
        }
    }

    private void generateThumbnail(String videoId, Path inputFile) {
        Process process = null;
        BufferedReader reader = null;

        try {
            Path thumbDir = thumbnailDir.resolve(videoId);
            Files.createDirectories(thumbDir);
            Path thumbFile = thumbDir.resolve("default.jpg");

            ProcessBuilder pb = new ProcessBuilder(
                    "ffmpeg", "-y",
                    "-i", inputFile.toAbsolutePath().toString(),
                    "-ss", "00:00:05",
                    "-vframes", "1",
                    "-vf", "scale=640:-1",
                    "-q:v", "2",  // Better quality
                    thumbFile.toAbsolutePath().toString()
            );

            pb.redirectErrorStream(true);
            process = pb.start();

            // Read output to prevent buffer overflow
            reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line;
            while ((line = reader.readLine()) != null) {
                // Consume output
            }

            boolean completed = process.waitFor(30, TimeUnit.SECONDS);
            if (!completed) {
                process.destroyForcibly();
                log.warn("Thumbnail generation timed out for {}", videoId);
            } else {
                log.debug("Generated thumbnail for {}", videoId);
            }
        } catch (Exception e) {
            log.warn("Failed to generate thumbnail: {}", e.getMessage());
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
            }
        } finally {
            closeQuietly(reader);
        }
    }

    /**
     * Transcodes the input to the given quality profile.
     * Overall DB progress is the average of all parallel quality percentages mapped to 5-95%.
     * This avoids the stuck-progress bug that sequential ranges cause when run in parallel.
     */
    private boolean transcodeQuality(String videoId, Path input, Path outputDir,
                                     QualityProfile profile,
                                     AtomicInteger sharedProgress,
                                     ConcurrentHashMap<String, Integer> qualityProgress) {
        Process process = null;
        BufferedReader reader = null;

        // Per-quality thread count: divide available cores by number of parallel jobs.
        // At least 2 threads per quality; falls back to 0 (auto) if Runtime returns 1.
        int availCores = Runtime.getRuntime().availableProcessors();
        int threads    = Math.max(2, availCores / Math.max(1, allowedQualities.size()));

        try {
            Path qualityDir = outputDir.resolve(profile.label);
            Files.createDirectories(qualityDir);

            log.info("[Transcoding] ▶ {} video={} threads={}", profile.label, videoId, threads);

            ProcessBuilder pb = new ProcessBuilder(
                    "ffmpeg", "-y",
                    "-i", input.toAbsolutePath().toString(),
                    "-threads",             String.valueOf(threads),
                    "-max_muxing_queue_size", "1024",
                    "-vf", "scale=" + profile.width + ":" + profile.height +
                           ":force_original_aspect_ratio=decrease,pad=" +
                           profile.width + ":" + profile.height + ":(ow-iw)/2:(oh-ih)/2",
                    "-c:v",      "libx264",
                    "-preset",   "veryfast",
                    "-crf",      String.valueOf(profile.crf()),
                    "-profile:v", profile.h264Profile(),
                    "-level",    profile.h264Level(),
                    "-pix_fmt",  "yuv420p",
                    "-c:a",      "aac",
                    "-b:a",      profile.audioBitrate(),
                    "-ar",       "44100",
                    "-movflags", "+faststart",
                    "-hls_time", String.valueOf(segmentDuration),
                    "-hls_playlist_type",    "vod",
                    "-hls_flags",            "independent_segments",
                    "-hls_segment_filename", qualityDir.resolve("seg_%05d.ts").toString(),
                    qualityDir.resolve("playlist.m3u8").toString()
            );
            pb.environment().put("MALLOC_ARENA_MAX", "2");
            pb.redirectErrorStream(true);

            process = pb.start();
            activeProcesses.put(videoId + "_" + profile.label, process);

            reader = new BufferedReader(new InputStreamReader(process.getInputStream()), 16384);
            double totalDuration = 0;

            String line;
            while ((line = reader.readLine()) != null) {
                if (totalDuration == 0 && line.contains("Duration:")) {
                    totalDuration = parseFfmpegTime(DURATION_PATTERN, line);
                }
                if (totalDuration > 0 && line.contains("time=")) {
                    double currentTime = parseFfmpegTime(TIME_PATTERN, line);
                    if (currentTime >= 0) {
                        double ratio = Math.min(currentTime / totalDuration, 1.0);
                        int qualityPct = (int) (ratio * 100);
                        // Update per-quality progress for UI
                        qualityProgress.put(profile.label, qualityPct);
                        // Overall progress = average of all quality percentages mapped to 5–95%
                        int sum = qualityProgress.values().stream().mapToInt(Integer::intValue).sum();
                        int avgPct = qualityProgress.isEmpty() ? 0 : sum / qualityProgress.size();
                        int overallPct = 5 + avgPct * 90 / 100;
                        int prev = sharedProgress.get();
                        if (overallPct >= prev + 5 && sharedProgress.compareAndSet(prev, overallPct)) {
                            videoService.updateProcessingProgress(videoId, overallPct);
                            log.info("[Transcoding] {} video={} {}% (overall {}%)",
                                    profile.label, videoId, qualityPct, overallPct);
                        }
                    }
                }
            }

            boolean completed = process.waitFor(PROCESS_TIMEOUT_MINUTES, TimeUnit.MINUTES);
            activeProcesses.remove(videoId + "_" + profile.label);

            if (!completed) {
                log.error("[Transcoding] ✗ timeout quality={} video={}", profile.label, videoId);
                process.destroyForcibly();
                deleteDirectoryRecursive(qualityDir);
                return false;
            }
            if (process.exitValue() != 0) {
                log.error("[Transcoding] ✗ FFmpeg exit={} quality={} video={}",
                        process.exitValue(), profile.label, videoId);
                deleteDirectoryRecursive(qualityDir);
                return false;
            }

            qualityProgress.put(profile.label, 100);
            log.info("[Transcoding] ✓ {} video={}", profile.label, videoId);
            return true;

        } catch (Exception e) {
            log.error("[Transcoding] ✗ error quality={} video={}: {}", profile.label, videoId, e.getMessage());
            if (process != null && process.isAlive()) process.destroyForcibly();
            return false;
        } finally {
            closeQuietly(reader);
        }
    }

    /** Parses HH:MM:SS.ms from an FFmpeg output line using the given pattern. Returns -1 on failure. */
    private static double parseFfmpegTime(Pattern pattern, String line) {
        try {
            Matcher m = pattern.matcher(line);
            if (m.find()) {
                double h   = Double.parseDouble(m.group(1));
                double min = Double.parseDouble(m.group(2));
                double sec = Double.parseDouble(m.group(3));
                return h * 3600 + min * 60 + sec;
            }
        } catch (Exception ignored) {}
        return -1;
    }

    private VideoInfo getVideoInfo(Path input) throws IOException, InterruptedException {
        Process process = null;
        BufferedReader reader = null;

        try {
            ProcessBuilder pb = new ProcessBuilder(
                    "ffprobe",
                    "-v", "error",
                    "-select_streams", "v:0",
                    "-show_entries", "stream=width,height,duration",
                    "-of", "csv=p=0",
                    input.toAbsolutePath().toString()
            );

            pb.redirectError(ProcessBuilder.Redirect.DISCARD);
            process = pb.start();

            reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line = reader.readLine();

            boolean completed = process.waitFor(30, TimeUnit.SECONDS);
            if (!completed) {
                process.destroyForcibly();
                log.warn("FFprobe timeout, using default values");
            }

            // Default values if parsing fails
            int width = 1920;
            int height = 1080;
            int duration = 0;

            if (line != null && !line.trim().isEmpty()) {
                try {
                    String[] parts = line.split(",");

                    // Parse width
                    if (parts.length >= 1 && !parts[0].trim().equalsIgnoreCase("N/A")) {
                        try {
                            width = Integer.parseInt(parts[0].trim());
                        } catch (NumberFormatException e) {
                            log.warn("[FFprobe] Failed to parse width: {}", parts[0]);
                        }
                    }

                    // Parse height
                    if (parts.length >= 2 && !parts[1].trim().equalsIgnoreCase("N/A")) {
                        try {
                            height = Integer.parseInt(parts[1].trim());
                        } catch (NumberFormatException e) {
                            log.warn("[FFprobe] Failed to parse height: {}", parts[1]);
                        }
                    }

                    // Parse duration
                    if (parts.length >= 3 && !parts[2].trim().equalsIgnoreCase("N/A")) {
                        try {
                            duration = (int) Double.parseDouble(parts[2].trim());
                        } catch (NumberFormatException e) {
                            log.warn("[FFprobe] Failed to parse duration: {}", parts[2]);
                        }
                    }

                    log.info("[FFprobe] Successfully parsed: width={}, height={}, duration={}", width, height, duration);
                } catch (Exception e) {
                    log.error("[FFprobe] Error parsing video info: {}", e.getMessage());
                }
            } else {
                log.warn("[FFprobe] No output received, using default values");
            }

            return new VideoInfo(width, height, duration);

        } finally {
            closeQuietly(reader);
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
            }
        }
    }

    private List<QualityProfile> buildQualityProfiles(VideoInfo info) {
        List<QualityProfile> profiles = new ArrayList<>();

        if (allowedQualities.contains("480p")) {
            profiles.add(new QualityProfile("480p", 854, 480, 1_500_000));
        }
        if (info.height >= 720 && allowedQualities.contains("720p")) {
            profiles.add(new QualityProfile("720p", 1280, 720, 3_000_000));
        }
        if (info.height >= 1080 && allowedQualities.contains("1080p")) {
            profiles.add(new QualityProfile("1080p", 1920, 1080, 6_000_000));
        }
        if (info.height >= 1440 && allowedQualities.contains("1440p")) {
            profiles.add(new QualityProfile("1440p", 2560, 1440, 12_000_000));
        }
        if (info.height >= 2160 && allowedQualities.contains("2160p")) {
            profiles.add(new QualityProfile("2160p", 3840, 2160, 25_000_000));
        }

        return profiles;
    }

    private void deleteDirectoryRecursive(Path dir) {
        try {
            if (Files.exists(dir)) {
                Files.walk(dir)
                        .sorted((a, b) -> b.compareTo(a))
                        .forEach(p -> {
                            try {
                                Files.deleteIfExists(p);
                            } catch (IOException ignored) {
                            }
                        });
            }
        } catch (IOException ignored) {
        }
    }

    private void closeQuietly(AutoCloseable closeable) {
        if (closeable != null) {
            try {
                closeable.close();
            } catch (Exception e) {
                // Ignore
            }
        }
    }

    private record VideoInfo(int width, int height, int durationSeconds) {
    }

    private record QualityProfile(String label, int width, int height, int bandwidth) {
        /** CRF tuned per resolution: lower res tolerates higher CRF */
        int crf() {
            return switch (label) {
                case "480p"  -> 28;
                case "720p"  -> 26;
                case "1080p" -> 24;
                case "1440p" -> 23;
                case "2160p" -> 22;
                default      -> 26;
            };
        }
        /** Audio bitrate per resolution */
        String audioBitrate() {
            return switch (label) {
                case "480p"  -> "96k";
                case "720p"  -> "128k";
                case "1080p" -> "160k";
                case "1440p" -> "192k";
                case "2160p" -> "256k";
                default      -> "128k";
            };
        }
        /** H.264 profile: baseline for ≤720p (broad device compat), high for ≥1080p (quality) */
        String h264Profile() {
            return switch (label) {
                case "480p", "720p" -> "baseline";
                default             -> "high";
            };
        }
        /** H.264 level matching resolution/framerate requirements */
        String h264Level() {
            return switch (label) {
                case "480p"  -> "3.1";
                case "720p"  -> "3.1";
                case "1080p" -> "4.0";
                case "1440p" -> "4.2";
                case "2160p" -> "5.1";
                default      -> "4.0";
            };
        }
    }
}