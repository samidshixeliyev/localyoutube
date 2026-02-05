package az.dev.localtube.service;

import az.dev.localtube.domain.VideoStatus;
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

@Slf4j
@Service
public class TranscodingService {

    // Process timeout to prevent hanging processes
    private static final long PROCESS_TIMEOUT_MINUTES = 60;
    private final VideoService videoService;
    private final Path hlsDir;
    private final Path thumbnailDir;
    private final int segmentDuration;
    private final List<String> allowedQualities;
    private final ConcurrentHashMap<String, Process> activeProcesses = new ConcurrentHashMap<>();

    public TranscodingService(VideoService videoService,
                              @Value("${localtube.storage.hls-dir}") String hlsDirPath,
                              @Value("${localtube.storage.thumbnail-dir}") String thumbnailDirPath,
                              @Value("${localtube.transcoding.segment-duration}") int segmentDuration,
                              @Value("${localtube.transcoding.qualities}") List<String> qualities) {
        this.videoService = videoService;
        this.hlsDir = Paths.get(hlsDirPath);
        this.thumbnailDir = Paths.get(thumbnailDirPath);
        this.segmentDuration = segmentDuration;
        this.allowedQualities = qualities;
    }

    @Async("videoProcessingExecutor")
    public void transcodeToHLS(String videoId, Path inputFile) {
        BufferedReader errorReader = null;

        try {
            log.info("[Transcoding] Starting for video ID: {}", videoId);

            videoService.updateVideoStatus(videoId, VideoStatus.PROCESSING);

            Path outputDir = hlsDir.resolve(videoId);
            Files.createDirectories(outputDir);

            // Generate thumbnail
            generateThumbnail(videoId, inputFile);

            // Get video info
            VideoInfo info = getVideoInfo(inputFile);
            log.info("[Transcoding] Input: {}x{}, duration: {}s", info.width, info.height, info.durationSeconds);

            videoService.updateVideoMetadata(videoId, info.width, info.height,
                    info.durationSeconds, Files.size(inputFile));

            // Build quality profiles
            List<QualityProfile> profiles = buildQualityProfiles(info);

            StringBuilder masterPlaylist = new StringBuilder();
            masterPlaylist.append("#EXTM3U\n");
            masterPlaylist.append("#EXT-X-VERSION:3\n");

            for (QualityProfile profile : profiles) {
                if (!transcodeQuality(videoId, inputFile, outputDir, profile)) {
                    log.error("[Transcoding] Failed for quality: {}", profile.label);
                    continue;
                }

                masterPlaylist.append("#EXT-X-STREAM-INF:BANDWIDTH=")
                        .append(profile.bandwidth)
                        .append(",RESOLUTION=")
                        .append(profile.width).append("x").append(profile.height)
                        .append("\n")
                        .append(profile.label).append("/playlist.m3u8\n");

                videoService.addQualityToVideo(videoId, profile.label);
            }

            Path masterFile = outputDir.resolve("master.m3u8");
            Files.writeString(masterFile, masterPlaylist.toString());

            // Delete original file to save space
            try {
                Files.deleteIfExists(inputFile);
                log.info("[Transcoding] Deleted original file to save space: {}", inputFile);
            } catch (IOException e) {
                log.warn("[Transcoding] Could not delete original file: {}", e.getMessage());
            }

            videoService.updateVideoStatus(videoId, VideoStatus.READY);
            log.info("[Transcoding] SUCCESS: {}", videoId);

            // Force garbage collection after transcoding
            System.gc();

        } catch (Exception e) {
            log.error("[Transcoding ERROR] Video ID: {}, Error: {}", videoId, e.getMessage(), e);
            try {
                videoService.updateVideoStatus(videoId, VideoStatus.FAILED);
                Files.deleteIfExists(inputFile);
            } catch (IOException ignored) {
            }
        } finally {
            closeQuietly(errorReader);
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

    private boolean transcodeQuality(String videoId, Path input, Path outputDir, QualityProfile profile) {
        Process process = null;
        BufferedReader reader = null;

        try {
            Path qualityDir = outputDir.resolve(profile.label);
            Files.createDirectories(qualityDir);

            log.info("[Transcoding] Processing {} for {}", profile.label, videoId);

            System.gc();

            ProcessBuilder pb = new ProcessBuilder(
                    "ffmpeg",
                    "-i", input.toAbsolutePath().toString(),

                    // MEMORY OPTIMIZATION FLAGS
                    "-threads", "1",  // Single thread to reduce memory
                    "-max_muxing_queue_size", "512",  // Reduce from 1024

                    "-vf", "scale=" + profile.width + ":" + profile.height +
                    ":force_original_aspect_ratio=decrease,pad=" +
                    profile.width + ":" + profile.height + ":(ow-iw)/2:(oh-ih)/2",
                    "-c:v", "libx264",
                    "-preset", "ultrafast",  // Changed from "veryfast"
                    "-crf", "26",  // Increased from 23 (lower quality = less memory)
                    "-profile:v", "baseline",  // Changed from "high"
                    "-level", "3.0",  // Reduced from 4.0
                    "-pix_fmt", "yuv420p",
                    "-c:a", "aac",
                    "-b:a", "96k",  // Reduced from 128k
                    "-ar", "44100",  // Reduced from 48000
                    "-movflags", "+faststart",
                    "-hls_time", String.valueOf(segmentDuration),
                    "-hls_playlist_type", "vod",
                    "-hls_flags", "independent_segments",
                    "-hls_segment_filename", qualityDir.resolve("seg_%03d.ts").toString(),
                    qualityDir.resolve("playlist.m3u8").toString()
            );

// Set process limits
            pb.environment().put("MALLOC_ARENA_MAX", "2");

            pb.redirectErrorStream(true);
            process = pb.start();
            activeProcesses.put(videoId + "_" + profile.label, process);

            // Read output with limited buffer to prevent memory issues
            reader = new BufferedReader(new InputStreamReader(process.getInputStream()), 8192);
            String line;
            int lineCount = 0;
            while ((line = reader.readLine()) != null) {
                lineCount++;
                // Only log every 100 lines to reduce memory usage
                if (lineCount % 100 == 0 && (line.contains("frame=") || line.contains("speed="))) {
                    log.debug("[FFmpeg {}] Processing...", profile.label);
                }
            }

            boolean completed = process.waitFor(PROCESS_TIMEOUT_MINUTES, TimeUnit.MINUTES);
            int exitCode = completed ? process.exitValue() : -1;

            activeProcesses.remove(videoId + "_" + profile.label);

            if (!completed) {
                log.error("[Transcoding] FFmpeg timeout for {}", profile.label);
                process.destroyForcibly();
                deleteDirectoryRecursive(qualityDir);
                return false;
            }

            if (exitCode != 0) {
                log.error("[Transcoding] FFmpeg failed with exit code: {}", exitCode);
                deleteDirectoryRecursive(qualityDir);
                return false;
            }

            log.info("[Transcoding] SUCCESS: {}", profile.label);
            return true;

        } catch (Exception e) {
            log.error("[Transcoding] Error for {}: {}", profile.label, e.getMessage());
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
            }
            return false;
        } finally {
            closeQuietly(reader);

            // Suggest GC after each quality transcoding
            System.gc();
        }
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