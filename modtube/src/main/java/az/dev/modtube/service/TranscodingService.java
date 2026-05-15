package az.dev.modtube.service;

import az.dev.modtube.domain.VideoStatus;
import az.dev.modtube.metrics.ModTubeMetrics;
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
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
public class TranscodingService {

    private static final long PROCESS_TIMEOUT_MINUTES = 60;

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

    public String getProcessingStage(String videoId) {
        return processingStages.getOrDefault(videoId, "");
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

            // Stage 3: per-quality transcoding (5 → 95%, split evenly)
            List<QualityProfile> profiles = buildQualityProfiles(info);
            int perQuality = profiles.isEmpty() ? 0 : 90 / profiles.size();

            StringBuilder masterPlaylist = new StringBuilder();
            masterPlaylist.append("#EXTM3U\n#EXT-X-VERSION:3\n");

            for (int i = 0; i < profiles.size(); i++) {
                QualityProfile profile = profiles.get(i);
                int rangeStart = 5 + i * perQuality;
                int rangeEnd   = 5 + (i + 1) * perQuality;

                processingStages.put(videoId, "Transcoding " + profile.label);
                if (!transcodeQuality(videoId, inputFile, outputDir, profile, rangeStart, rangeEnd)) {
                    log.error("[Transcoding] ✗ quality={} video={}", profile.label, videoId);
                    continue;
                }
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
     * progressStart/End define the overall 0-100 range this quality maps to,
     * so the DB progress value rises smoothly across all qualities.
     */
    private boolean transcodeQuality(String videoId, Path input, Path outputDir,
                                     QualityProfile profile, int progressStart, int progressEnd) {
        Process process = null;
        BufferedReader reader = null;

        try {
            Path qualityDir = outputDir.resolve(profile.label);
            Files.createDirectories(qualityDir);
            System.gc();

            log.info("[Transcoding] ▶ {} video={} (progress {}→{}%)",
                    profile.label, videoId, progressStart, progressEnd);

            ProcessBuilder pb = new ProcessBuilder(
                    "ffmpeg",
                    "-i", input.toAbsolutePath().toString(),
                    "-threads", "1",
                    "-max_muxing_queue_size", "512",
                    "-vf", "scale=" + profile.width + ":" + profile.height +
                           ":force_original_aspect_ratio=decrease,pad=" +
                           profile.width + ":" + profile.height + ":(ow-iw)/2:(oh-ih)/2",
                    "-c:v", "libx264",
                    "-preset", "ultrafast",
                    "-crf", "26",
                    "-profile:v", "baseline",
                    "-level", "3.0",
                    "-pix_fmt", "yuv420p",
                    "-c:a", "aac",
                    "-b:a", "96k",
                    "-ar", "44100",
                    "-movflags", "+faststart",
                    "-hls_time", String.valueOf(segmentDuration),
                    "-hls_playlist_type", "vod",
                    "-hls_flags", "independent_segments",
                    "-hls_segment_filename", qualityDir.resolve("seg_%03d.ts").toString(),
                    qualityDir.resolve("playlist.m3u8").toString()
            );
            pb.environment().put("MALLOC_ARENA_MAX", "2");
            pb.redirectErrorStream(true);

            process = pb.start();
            activeProcesses.put(videoId + "_" + profile.label, process);

            // Parse FFmpeg stdout/stderr for Duration + time= progress
            reader = new BufferedReader(new InputStreamReader(process.getInputStream()), 16384);
            double totalDuration = 0;
            int lastWrittenPct = progressStart; // only write DB when we move 5+ points

            String line;
            while ((line = reader.readLine()) != null) {
                // Extract total duration once
                if (totalDuration == 0 && line.contains("Duration:")) {
                    totalDuration = parseFfmpegTime(DURATION_PATTERN, line);
                }

                // Parse current encoding position
                if (totalDuration > 0 && line.contains("time=")) {
                    double currentTime = parseFfmpegTime(TIME_PATTERN, line);
                    if (currentTime >= 0) {
                        double ratio = Math.min(currentTime / totalDuration, 1.0);
                        int overallPct = progressStart + (int) ((progressEnd - progressStart) * ratio);
                        int qualityPct = (int) (ratio * 100);

                        // Write DB only every 5 points to avoid flooding
                        if (overallPct >= lastWrittenPct + 5) {
                            videoService.updateProcessingProgress(videoId, overallPct);
                            lastWrittenPct = overallPct;
                            log.info("[Transcoding] {} video={} {}% (overall {}%)",
                                    profile.label, videoId, qualityPct, overallPct);
                        }
                    }
                }
            }

            boolean completed = process.waitFor(PROCESS_TIMEOUT_MINUTES, TimeUnit.MINUTES);
            activeProcesses.remove(videoId + "_" + profile.label);
            int exitCode = completed ? process.exitValue() : -1;

            if (!completed) {
                log.error("[Transcoding] ✗ timeout quality={} video={}", profile.label, videoId);
                process.destroyForcibly();
                deleteDirectoryRecursive(qualityDir);
                return false;
            }
            if (exitCode != 0) {
                log.error("[Transcoding] ✗ FFmpeg exit={} quality={} video={}",
                        exitCode, profile.label, videoId);
                deleteDirectoryRecursive(qualityDir);
                return false;
            }

            videoService.updateProcessingProgress(videoId, progressEnd);
            log.info("[Transcoding] ✓ {} video={}", profile.label, videoId);
            return true;

        } catch (Exception e) {
            log.error("[Transcoding] ✗ error quality={} video={}: {}", profile.label, videoId, e.getMessage());
            if (process != null && process.isAlive()) process.destroyForcibly();
            return false;
        } finally {
            closeQuietly(reader);
            System.gc();
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
    }
}