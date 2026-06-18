package ao.az.modtube.service;

import ao.az.modtube.domain.Video;
import ao.az.modtube.domain.VideoStatus;
import ao.az.modtube.metrics.ModTubeMetrics;
import org.springframework.beans.factory.annotation.Autowired;
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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
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
    private final StorageService storageService;
    private final Path hlsDir;
    private final Path thumbnailDir;
    private final int segmentDuration;
    private final List<String> allowedQualities;

    @Autowired
    private SystemSettingService settingService;
    private final ConcurrentHashMap<String, Process> activeProcesses = new ConcurrentHashMap<>();

    /** Human-readable stage exposed via GET /api/upload/status/{id} */
    private final ConcurrentHashMap<String, String> processingStages = new ConcurrentHashMap<>();

    /** Per-quality progress (0-100) per video, for detailed UI feedback */
    private final ConcurrentHashMap<String, ConcurrentHashMap<String, Integer>> qualityProgressMap =
            new ConcurrentHashMap<>();

    /** Last FFmpeg failure reason keyed by "{videoId}_{label}", for diagnostics. */
    private final ConcurrentHashMap<String, String> failureReasons = new ConcurrentHashMap<>();

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
                              StorageService storageService,
                              @Value("${modtube.storage.hls-dir}") String hlsDirPath,
                              @Value("${modtube.storage.thumbnail-dir}") String thumbnailDirPath,
                              @Value("${modtube.transcoding.segment-duration}") int segmentDuration,
                              @Value("${modtube.transcoding.qualities}") List<String> qualities) {
        this.videoService = videoService;
        this.metrics = metrics;
        this.storageService = storageService;
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

            // Cap concurrent FFmpeg jobs so decoding a 4K source N times in parallel
            // doesn't blow the container memory limit (OOM → killed renditions /
            // restart). At most 2 run at once; the rest queue. Each gets a fair
            // thread share of the box.
            final int maxParallel = Math.max(1, Math.min(2, profiles.size()));
            ExecutorService pool = Executors.newFixedThreadPool(maxParallel);
            boolean[] results = new boolean[profiles.size()];
            try {
                List<CompletableFuture<Map.Entry<Integer, Boolean>>> futures = new ArrayList<>();
                for (int i = 0; i < profiles.size(); i++) {
                    final QualityProfile profile = profiles.get(i);
                    final int idx = i;
                    futures.add(CompletableFuture.supplyAsync(() -> {
                        boolean ok = transcodeQuality(videoId, inputFile, outputDir, profile,
                                sharedProgress, qp, maxParallel);
                        return Map.entry(idx, ok);
                    }, pool));
                }
                CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
                for (CompletableFuture<Map.Entry<Integer, Boolean>> f : futures) {
                    Map.Entry<Integer, Boolean> r = f.join();
                    results[r.getKey()] = r.getValue();
                }
            } finally {
                pool.shutdown();
            }
            qualityProgressMap.remove(videoId);

            StringBuilder masterPlaylist = new StringBuilder();
            masterPlaylist.append("#EXTM3U\n#EXT-X-VERSION:3\n");

            int okCount = 0;
            List<String> failedLabels = new ArrayList<>();
            for (int i = 0; i < profiles.size(); i++) {
                if (!results[i]) {
                    String reason = failureReasons.remove(videoId + "_" + profiles.get(i).label);
                    log.error("[Transcoding] ✗ quality={} video={} reason={}",
                            profiles.get(i).label, videoId, reason != null ? reason : "unknown");
                    failedLabels.add(profiles.get(i).label);
                    continue;
                }
                QualityProfile profile = profiles.get(i);
                masterPlaylist.append("#EXT-X-STREAM-INF:BANDWIDTH=")
                        .append(profile.bandwidth)
                        .append(",RESOLUTION=")
                        .append(profile.width).append("x").append(profile.height)
                        .append("\n").append(profile.label).append("/playlist.m3u8\n");
                videoService.addQualityToVideo(videoId, profile.label);
                okCount++;
            }

            // If EVERY rendition failed there's nothing to serve → fail with the reason.
            if (okCount == 0) {
                throw new IllegalStateException("All renditions failed ("
                        + String.join(", ", failedLabels) + "). Often RAM/OOM under parallel "
                        + "transcoding — raise MEM_LIMIT or reduce qualities.");
            }
            if (!failedLabels.isEmpty()) {
                log.warn("[Transcoding] video={} completed with {} ok, failed: {}",
                        videoId, okCount, failedLabels);
            }

            // Stage 4: finalise (95 → 100%)
            processingStages.put(videoId, "Finalising");
            videoService.updateProcessingProgress(videoId, 95);
            Files.writeString(outputDir.resolve("master.m3u8"), masterPlaylist.toString());

            // Stage 5: store HLS output to MinIO, then free scratch.
            processingStages.put(videoId, "Uploading to storage");
            storageService.uploadDirectory(outputDir, "hls/" + videoId);
            log.info("[Transcoding] Uploaded HLS for video={} ({} renditions) to MinIO", videoId, okCount);

            // Keep the ORIGINAL upload in MinIO (originals/{id}/<filename>) so it can be downloaded.
            try {
                String origName = inputFile.getFileName().toString();
                String origKey = "originals/" + videoId + "/" + origName;
                storageService.putObject(origKey, inputFile, StorageService.contentTypeFor(origName));
                videoService.updateOriginalUrl(videoId, "/originals/" + videoId + "/" + origName);
                log.info("[Transcoding] Stored original upload for video={} as {}", videoId, origKey);
            } catch (Exception e) {
                // Non-fatal: HLS already stored. Log but don't fail the video.
                log.warn("[Transcoding] Could not store original for video={}: {}", videoId, e.getMessage());
            }

            // Remove ALL local scratch — nothing is persisted on disk; everything lives in MinIO.
            try { Files.deleteIfExists(inputFile); }
            catch (IOException e) { log.warn("[Transcoding] Could not delete original scratch: {}", e.getMessage()); }
            deleteDirectoryRecursive(outputDir);
            deleteDirectoryRecursive(thumbnailDir.resolve(videoId));

            videoService.updateProcessingProgress(videoId, 100);
            videoService.updateVideoStatus(videoId, VideoStatus.READY);
            processingStages.put(videoId, "Ready");
            log.info("[Transcoding] ✓ Done video={}", videoId);
            metrics.recordTranscodingSuccess();
            metrics.recordTranscodingDuration(System.currentTimeMillis() - startMs);
            System.gc();

        } catch (Exception e) {
            String reason = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            log.error("[Transcoding] ✗ ERROR video={}: {}", videoId, reason, e);
            processingStages.put(videoId, "Failed: " + reason);
            metrics.recordTranscodingFailure();
            metrics.recordTranscodingDuration(System.currentTimeMillis() - startMs);
            try {
                videoService.updateProcessingError(videoId, reason);   // surface WHY to the UI
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
                // Push to MinIO immediately so the UI can show it during transcoding.
                try {
                    if (Files.exists(thumbFile)) {
                        storageService.putObject("thumbnails/" + videoId + "/default.jpg", thumbFile, "image/jpeg");
                    }
                } catch (Exception e) {
                    log.warn("Failed to upload thumbnail for {}: {}", videoId, e.getMessage());
                }
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
                                     ConcurrentHashMap<String, Integer> qualityProgress,
                                     int maxParallel) {
        Process process = null;
        BufferedReader reader = null;

        // Per-quality thread count. At most `maxParallel` jobs run at once, so divide
        // usable cores by that (not the total quality count) — leaves a core for the
        // API/DB and avoids both CPU oversubscription and 1-thread-slow 4K encodes.
        int availCores  = Runtime.getRuntime().availableProcessors();
        int usableCores = Math.max(1, availCores - 1);
        int threads     = Math.max(1, usableCores / Math.max(1, maxParallel));

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
                    "-preset",   "fast",
                    "-crf",      String.valueOf(profile.crf()),
                    "-profile:v", profile.h264Profile(),
                    "-level",    profile.h264Level(),
                    "-pix_fmt",  "yuv420p",
                    "-g",        String.valueOf(segmentDuration * 30),
                    "-keyint_min", String.valueOf(segmentDuration * 30),
                    "-force_key_frames", "expr:gte(t,n_forced*" + segmentDuration + ")",
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
            // Run FFmpeg at the lowest CPU priority on Unix so request handling
            // (API/DB) always wins the CPU — keeps response times low during uploads.
            if (!System.getProperty("os.name", "").toLowerCase().contains("win")) {
                List<String> niced = new ArrayList<>(pb.command());
                niced.add(0, "19"); niced.add(0, "-n"); niced.add(0, "nice");
                pb.command(niced);
            }
            pb.environment().put("MALLOC_ARENA_MAX", "2");
            pb.redirectErrorStream(true);

            process = pb.start();
            activeProcesses.put(videoId + "_" + profile.label, process);

            reader = new BufferedReader(new InputStreamReader(process.getInputStream()), 16384);
            double totalDuration = 0;

            // Keep the last few FFmpeg lines so a failure reports WHY (not a generic error).
            java.util.ArrayDeque<String> tail = new java.util.ArrayDeque<>();
            String line;
            while ((line = reader.readLine()) != null) {
                if (tail.size() >= 12) tail.pollFirst();
                tail.addLast(line);
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

            String ffTail = String.join(" | ", tail);
            if (!completed) {
                String reason = "timeout after " + PROCESS_TIMEOUT_MINUTES + "m";
                failureReasons.put(videoId + "_" + profile.label, reason);
                log.error("[Transcoding] ✗ {} quality={} video={} :: {}", reason, profile.label, videoId, ffTail);
                process.destroyForcibly();
                deleteDirectoryRecursive(qualityDir);
                return false;
            }
            if (process.exitValue() != 0) {
                String reason = "FFmpeg exit=" + process.exitValue() + " :: " + ffTail;
                failureReasons.put(videoId + "_" + profile.label, reason);
                log.error("[Transcoding] ✗ FFmpeg exit={} quality={} video={} :: {}",
                        process.exitValue(), profile.label, videoId, ffTail);
                deleteDirectoryRecursive(qualityDir);
                return false;
            }

            qualityProgress.put(profile.label, 100);
            log.info("[Transcoding] ✓ {} video={}", profile.label, videoId);
            return true;

        } catch (Exception e) {
            String reason = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            failureReasons.put(videoId + "_" + profile.label, reason);
            log.error("[Transcoding] ✗ error quality={} video={}: {}", profile.label, videoId, reason);
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
        // Two admin controls (runtime settings, override yaml):
        //  1. "upload.qualities" — explicit comma list e.g. "480p,1080p" (custom selection).
        //     When set, ONLY those renditions are produced.
        //  2. "upload.max-quality" — a simple ceiling (used when no explicit list).
        String selected = settingService.get("upload.qualities", "").trim();
        java.util.Set<String> chosen;
        if (!selected.isEmpty()) {
            chosen = new java.util.HashSet<>();
            for (String s : selected.split(",")) {
                String q = s.trim().toLowerCase();
                if (!q.isEmpty()) chosen.add(q);
            }
        } else {
            int maxHeight = switch (settingService.get("upload.max-quality", "2160p")) {
                case "480p"  -> 480;
                case "720p"  -> 720;
                case "1080p" -> 1080;
                case "1440p" -> 1440;
                default      -> 2160;
            };
            chosen = new java.util.HashSet<>();
            if (maxHeight >= 480)  chosen.add("480p");
            if (maxHeight >= 720)  chosen.add("720p");
            if (maxHeight >= 1080) chosen.add("1080p");
            if (maxHeight >= 1440) chosen.add("1440p");
            if (maxHeight >= 2160) chosen.add("2160p");
        }

        // A rendition is built only if: chosen by admin, enabled in yaml, and the
        // source is at least that tall (never upscale).
        List<QualityProfile> profiles = new ArrayList<>();
        if (want(chosen, "480p",  info, 0))    profiles.add(new QualityProfile("480p", 854, 480, 1_500_000));
        if (want(chosen, "720p",  info, 720))  profiles.add(new QualityProfile("720p", 1280, 720, 3_000_000));
        if (want(chosen, "1080p", info, 1080)) profiles.add(new QualityProfile("1080p", 1920, 1080, 6_000_000));
        if (want(chosen, "1440p", info, 1440)) profiles.add(new QualityProfile("1440p", 2560, 1440, 12_000_000));
        if (want(chosen, "2160p", info, 2160)) profiles.add(new QualityProfile("2160p", 3840, 2160, 25_000_000));

        // Safety net: if nothing matched (e.g. tiny source vs high-only selection),
        // always produce at least 480p so the video is playable.
        if (profiles.isEmpty()) {
            profiles.add(new QualityProfile("480p", 854, 480, 1_500_000));
        }
        log.info("[Transcoding] qualities selected={} for source {}x{}",
                profiles.stream().map(QualityProfile::label).toList(), info.width, info.height);
        return profiles;
    }

    private boolean want(java.util.Set<String> chosen, String label, VideoInfo info, int minHeight) {
        return chosen.contains(label) && allowedQualities.contains(label) && info.height >= minHeight;
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
                case "480p"  -> 23;
                case "720p"  -> 21;
                case "1080p" -> 19;
                case "1440p" -> 18;
                case "2160p" -> 17;
                default      -> 21;
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
                case "480p" -> "baseline";
                case "720p" -> "main";
                default     -> "high";
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