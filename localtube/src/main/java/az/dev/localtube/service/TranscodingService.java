package az.dev.localtube.service;

import az.dev.localtube.domain.VideoStatus;
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

@Service
public class TranscodingService {

    private final VideoService videoService;
    private final Path hlsDir;
    private final int segmentDuration;
    private final List<String> allowedQualities;

    private final ConcurrentHashMap<String, Process> activeProcesses = new ConcurrentHashMap<>();

    public TranscodingService(VideoService videoService,
                              @Value("${localtube.storage.hls-dir}") String hlsDirPath,
                              @Value("${localtube.transcoding.segment-duration}") int segmentDuration,
                              @Value("${localtube.transcoding.qualities}") List<String> qualities) {
        this.videoService = videoService;
        this.hlsDir = Paths.get(hlsDirPath);
        this.segmentDuration = segmentDuration;
        this.allowedQualities = qualities;
    }

    @Async("videoProcessingExecutor")
    public void transcodeToHLS(String videoId, Path inputFile) {
        try {
            System.out.println("[Transcoding] Starting for video: " + videoId);

            videoService.updateVideoStatus(videoId, VideoStatus.PROCESSING);

            Path outputDir = hlsDir.resolve(videoId);
            Files.createDirectories(outputDir);

            VideoInfo info = getVideoInfo(inputFile);
            System.out.println("[Transcoding] Input: " + info.width + "x" + info.height + ", duration: " + info.durationSeconds + "s");

            videoService.updateVideoMetadata(videoId, info.width, info.height,
                    info.durationSeconds, Files.size(inputFile));

            List<QualityProfile> profiles = buildQualityProfiles(info);

            StringBuilder masterPlaylist = new StringBuilder();
            masterPlaylist.append("#EXTM3U\n");
            masterPlaylist.append("#EXT-X-VERSION:3\n");

            for (QualityProfile profile : profiles) {
                if (!transcodeQuality(videoId, inputFile, outputDir, profile)) {
                    System.err.println("[Transcoding] Failed for quality: " + profile.label);
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

            Files.deleteIfExists(inputFile);

            videoService.updateVideoStatus(videoId, VideoStatus.READY);

            System.out.println("[Transcoding] SUCCESS: " + videoId);

        } catch (Exception e) {
            System.err.println("[Transcoding ERROR] " + e.getMessage());
            e.printStackTrace();

            try {
                videoService.updateVideoStatus(videoId, VideoStatus.FAILED);
                Files.deleteIfExists(inputFile);
            } catch (IOException ignored) {}
        }
    }

    private boolean transcodeQuality(String videoId, Path input, Path outputDir, QualityProfile profile) {
        try {
            Path qualityDir = outputDir.resolve(profile.label);
            Files.createDirectories(qualityDir);

            System.out.println("[Transcoding] Processing " + profile.label + " for " + videoId);

            ProcessBuilder pb = new ProcessBuilder(
                    "ffmpeg",
                    "-i", input.toAbsolutePath().toString(),
                    "-vf", "scale=" + profile.width + ":" + profile.height +
                    ":force_original_aspect_ratio=decrease,pad=" +
                    profile.width + ":" + profile.height + ":(ow-iw)/2:(oh-ih)/2",
                    "-c:v", "libx264",
                    "-preset", "fast",
                    "-crf", "23",
                    "-profile:v", "high",
                    "-level", "4.0",
                    "-pix_fmt", "yuv420p",
                    "-c:a", "aac",
                    "-b:a", "128k",
                    "-ar", "48000",
                    "-movflags", "+faststart",
                    "-hls_time", String.valueOf(segmentDuration),
                    "-hls_playlist_type", "vod",
                    "-hls_flags", "independent_segments",
                    "-hls_segment_filename", qualityDir.resolve("seg_%03d.ts").toString(),
                    qualityDir.resolve("playlist.m3u8").toString()
            );

            pb.redirectErrorStream(true);

            Process process = pb.start();
            activeProcesses.put(videoId + "_" + profile.label, process);

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.contains("frame=") || line.contains("speed=")) {
                        System.out.println("[FFmpeg " + profile.label + "] " + line);
                    }
                }
            }

            int exitCode = process.waitFor();
            activeProcesses.remove(videoId + "_" + profile.label);

            if (exitCode != 0) {
                System.err.println("[Transcoding] FFmpeg failed with exit code: " + exitCode);
                deleteDirectoryRecursive(qualityDir);
                return false;
            }

            System.out.println("[Transcoding] SUCCESS: " + profile.label);
            return true;

        } catch (Exception e) {
            System.err.println("[Transcoding] Error for " + profile.label + ": " + e.getMessage());
            return false;
        }
    }

    private VideoInfo getVideoInfo(Path input) throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(
                "ffprobe",
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height,duration",
                "-of", "csv=p=0",
                input.toAbsolutePath().toString()
        );

        pb.redirectError(ProcessBuilder.Redirect.DISCARD);

        Process process = pb.start();
        String line;

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            line = reader.readLine();
        }

        process.waitFor();

        if (line != null) {
            String[] parts = line.split(",");
            if (parts.length >= 2) {
                int width = Integer.parseInt(parts[0].trim());
                int height = Integer.parseInt(parts[1].trim());
                int duration = parts.length >= 3 ? (int) Double.parseDouble(parts[2].trim()) : 0;
                return new VideoInfo(width, height, duration);
            }
        }

        return new VideoInfo(1920, 1080, 0);
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
                            } catch (IOException e) {
                                System.err.println("[Transcoding] Cannot delete: " + p);
                            }
                        });
            }
        } catch (IOException e) {
            System.err.println("[Transcoding] Delete failed: " + dir);
        }
    }

    private static class VideoInfo {
        final int width, height, durationSeconds;
        VideoInfo(int width, int height, int durationSeconds) {
            this.width = width;
            this.height = height;
            this.durationSeconds = durationSeconds;
        }
    }

    private static class QualityProfile {
        final String label;
        final int width, height, bandwidth;
        QualityProfile(String label, int width, int height, int bandwidth) {
            this.label = label;
            this.width = width;
            this.height = height;
            this.bandwidth = bandwidth;
        }
    }
}