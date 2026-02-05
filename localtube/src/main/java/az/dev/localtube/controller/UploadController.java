package az.dev.localtube.controller;

import az.dev.localtube.domain.Video;
import az.dev.localtube.domain.VideoStatus;
import az.dev.localtube.service.TranscodingService;
import az.dev.localtube.service.VideoService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.channels.Channels;
import java.nio.channels.FileChannel;
import java.nio.channels.ReadableByteChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/upload")
public class UploadController {

    private final VideoService videoService;
    private final TranscodingService transcodingService;
    private final Path uploadDir;
    private final long maxFileSize;
    private final long minDiskFree;

    // Reduced buffer size for better memory management
    private static final int BUFFER_SIZE = 64 * 1024; // 64KB instead of 8KB for better performance
    private static final int MAX_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB max chunk

    public UploadController(VideoService videoService,
                            TranscodingService transcodingService,
                            @Value("${localtube.storage.upload-dir}") String uploadDirPath,
                            @Value("${localtube.storage.max-file-size}") long maxFileSize,
                            @Value("${localtube.storage.min-disk-free}") long minDiskFree) throws IOException {
        this.videoService = videoService;
        this.transcodingService = transcodingService;
        this.uploadDir = Paths.get(uploadDirPath);
        this.maxFileSize = maxFileSize;
        this.minDiskFree = minDiskFree;
        Files.createDirectories(this.uploadDir);
    }

    @GetMapping("/videos")
    public ResponseEntity<List<Map<String, Object>>> listVideos() {
        try {
            List<Video> videos = videoService.getAllVideos();
            List<Map<String, Object>> result = videos.stream()
                    .map(this::videoToMap)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(result);
        } catch (IOException e) {
            log.error("Error listing videos", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/init")
    public ResponseEntity<Map<String, String>> initUpload(
            @RequestParam String filename,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String description,
            @RequestParam long totalSize,
            @RequestParam int totalChunks) {

        try {
            if (totalSize > maxFileSize) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "File too large. Max " + (maxFileSize / (1024 * 1024 * 1024)) + " GB"));
            }

            long freeSpace = Files.getFileStore(uploadDir).getUsableSpace();
            if (freeSpace < totalSize + minDiskFree) {
                return ResponseEntity.status(507).body(Map.of("error", "Not enough disk space"));
            }

            String videoTitle = title != null ? title : filename;
            String videoDesc = description != null ? description : "";

            // Create video with UUID
            Video video = videoService.createVideo(videoTitle, filename, videoDesc);

            // Create upload directory for this video
            Path videoDir = uploadDir.resolve(video.getId());
            Files.createDirectories(videoDir);

            return ResponseEntity.ok(Map.of(
                    "status", "initialized",
                    "videoId", video.getId(),
                    "uploadId", video.getId() + "_" + System.currentTimeMillis()
            ));

        } catch (IOException e) {
            log.error("Error initializing upload", e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/chunk")
    public ResponseEntity<Map<String, Object>> uploadChunk(
            @RequestParam("file") MultipartFile chunk,
            @RequestParam int chunkIndex,
            @RequestParam int totalChunks,
            @RequestParam String videoId) {

        InputStream inputStream = null;
        FileChannel fileChannel = null;
        ReadableByteChannel readChannel = null;

        try {
            // Validate chunk size
            if (chunk.getSize() > MAX_CHUNK_SIZE) {
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "error",
                        "message", "Chunk size too large"));
            }

            // Get video
            Video video = videoService.getVideo(videoId).orElse(null);
            if (video == null) {
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "error",
                        "message", "Video not found"));
            }

            Path videoDir = uploadDir.resolve(videoId);
            Files.createDirectories(videoDir);

            String extension = getFileExtension(video.getFilename());
            Path targetFile = videoDir.resolve("original." + extension);

            // Use NIO FileChannel for better performance and memory efficiency
            StandardOpenOption[] options = (chunkIndex == 0)
                    ? new StandardOpenOption[]{StandardOpenOption.CREATE, StandardOpenOption.WRITE, StandardOpenOption.TRUNCATE_EXISTING}
                    : new StandardOpenOption[]{StandardOpenOption.CREATE, StandardOpenOption.WRITE, StandardOpenOption.APPEND};

            // Stream directly from multipart to file without loading into memory
            inputStream = new BufferedInputStream(chunk.getInputStream(), BUFFER_SIZE);
            fileChannel = FileChannel.open(targetFile, options);
            readChannel = Channels.newChannel(inputStream);

            // Transfer data efficiently using NIO
            long position = chunkIndex == 0 ? 0 : Files.size(targetFile);
            long transferred = fileChannel.transferFrom(readChannel, position, chunk.getSize());

            log.debug("Uploaded chunk {}/{} for video {}, transferred {} bytes",
                    chunkIndex + 1, totalChunks, videoId, transferred);

            double progress = (double) (chunkIndex + 1) / totalChunks * 100;

            return ResponseEntity.ok(Map.of(
                    "status", "chunk_received",
                    "chunkIndex", chunkIndex,
                    "progress", String.format("%.1f%%", progress)
            ));

        } catch (IOException e) {
            log.error("Error uploading chunk {} for video {}", chunkIndex, videoId, e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "status", "error",
                    "message", e.getMessage()));
        } finally {
            // Explicitly close all resources to free memory immediately
            closeQuietly(readChannel);
            closeQuietly(fileChannel);
            closeQuietly(inputStream);

            // Suggest garbage collection (JVM will decide)
            if (chunkIndex % 10 == 0) {
                System.gc();
            }
        }
    }

    @PostMapping("/complete")
    public ResponseEntity<Map<String, Object>> completeUpload(
            @RequestParam String videoId,
            @RequestParam int totalChunks) {

        try {
            Video video = videoService.getVideo(videoId).orElse(null);
            if (video == null) {
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "failed",
                        "message", "Video not found"));
            }

            String extension = getFileExtension(video.getFilename());
            Path videoDir = uploadDir.resolve(videoId);
            Path uploadedFile = videoDir.resolve("original." + extension);

            if (!Files.exists(uploadedFile)) {
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "failed",
                        "message", "File not found"));
            }

            // Verify file size
            long fileSize = Files.size(uploadedFile);
            log.info("Upload completed for video {}, file size: {} MB",
                    videoId, fileSize / (1024 * 1024));

            // Start transcoding with video ID (async - won't block)
            transcodingService.transcodeToHLS(videoId, uploadedFile);

            return ResponseEntity.accepted().body(Map.of(
                    "status", "processing_started",
                    "videoId", videoId,
                    "hlsUrl", "/hls/" + videoId + "/master.m3u8"
            ));

        } catch (Exception e) {
            log.error("Error completing upload for video {}", videoId, e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "status", "error",
                    "message", e.getMessage()));
        }
    }

    @GetMapping("/videos/{id}")
    public ResponseEntity<Map<String, Object>> getVideo(@PathVariable String id) {
        try {
            return videoService.getVideo(id)
                    .map(video -> ResponseEntity.ok(videoToMap(video)))
                    .orElse(ResponseEntity.notFound().build());
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/videos/{id}/view")
    public ResponseEntity<Void> incrementViews(@PathVariable String id) {
        try {
            videoService.incrementViews(id);
            return ResponseEntity.ok().build();
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/videos/{id}/like")
    public ResponseEntity<Void> incrementLikes(@PathVariable String id) {
        try {
            videoService.incrementLikes(id);
            return ResponseEntity.ok().build();
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @DeleteMapping("/videos/{id}")
    public ResponseEntity<Void> deleteVideo(@PathVariable String id) {
        try {
            videoService.deleteVideo(id);
            return ResponseEntity.ok().build();
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/search")
    public ResponseEntity<List<Map<String, Object>>> searchVideos(@RequestParam String query) {
        try {
            List<Video> videos = videoService.searchVideos(query);
            List<Map<String, Object>> result = videos.stream()
                    .map(this::videoToMap)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(result);
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    private String getFileExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "mp4";
        }
        return filename.substring(filename.lastIndexOf('.') + 1);
    }

    private Map<String, Object> videoToMap(Video video) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", video.getId());
        map.put("name", video.getTitle());
        map.put("title", video.getTitle());
        map.put("description", video.getDescription());
        map.put("filename", video.getFilename());
        map.put("status", video.getStatus() != null ? video.getStatus().name().toLowerCase() : null);
        map.put("hlsUrl", video.getStatus() == VideoStatus.READY ? video.getMasterPlaylistUrl() : null);
        map.put("thumbnailUrl", video.getThumbnailUrl());
        map.put("qualities", video.getAvailableQualities());
        map.put("views", video.getViews());
        map.put("likes", video.getLikes());
        map.put("duration", video.getDurationSeconds());
        map.put("width", video.getWidth());
        map.put("height", video.getHeight());
        map.put("uploadedAt", video.getUploadedAt());
        map.put("processedAt", video.getProcessedAt());
        return map;
    }

    private void closeQuietly(AutoCloseable closeable) {
        if (closeable != null) {
            try {
                closeable.close();
            } catch (Exception e) {
                log.debug("Error closing resource", e);
            }
        }
    }
}