package az.dev.localtube.controller;

import az.dev.localtube.config.security.LocalTubeUserDetails;
import az.dev.localtube.domain.Video;
import az.dev.localtube.domain.VideoStatus;
import az.dev.localtube.service.TranscodingService;
import az.dev.localtube.service.VideoService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
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

    private static final int MAX_CHUNK_SIZE = 10 * 1024 * 1024;

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
    @PreAuthorize("hasAnyAuthority('admin-modtube', 'super-admin')")
    public ResponseEntity<Map<String, String>> initUpload(
            @RequestParam String filename,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String description,
            @RequestParam long totalSize,
            @RequestParam int totalChunks,
            @AuthenticationPrincipal LocalTubeUserDetails user) {

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

            Video video = videoService.createVideo(
                    videoTitle, filename, videoDesc,
                    null,
                    user.getUserId(),
                    user.getUser().getFullName(),
                    user.getEmail()
            );

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
    @PreAuthorize("hasAnyAuthority('admin-modtube', 'super-admin')")
    public ResponseEntity<Map<String, Object>> uploadChunk(
            @RequestParam("file") MultipartFile chunk,
            @RequestParam int chunkIndex,
            @RequestParam int totalChunks,
            @RequestParam String videoId,
            @AuthenticationPrincipal LocalTubeUserDetails user) {

        try {
            if (chunk.getSize() > MAX_CHUNK_SIZE) {
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "error",
                        "message", "Chunk size too large"));
            }

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

            StandardOpenOption[] options = (chunkIndex == 0)
                    ? new StandardOpenOption[]{StandardOpenOption.CREATE, StandardOpenOption.WRITE, StandardOpenOption.TRUNCATE_EXISTING}
                    : new StandardOpenOption[]{StandardOpenOption.CREATE, StandardOpenOption.WRITE, StandardOpenOption.APPEND};

            try (InputStream inputStream = chunk.getInputStream();
                 OutputStream outputStream = Files.newOutputStream(targetFile, options)) {
                byte[] buffer = new byte[8192];
                int bytesRead;
                while ((bytesRead = inputStream.read(buffer)) != -1) {
                    outputStream.write(buffer, 0, bytesRead);
                }
                outputStream.flush();
            }

            log.debug("Uploaded chunk {}/{} for video {}", chunkIndex + 1, totalChunks, videoId);

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
        }
    }

    @PostMapping("/complete")
    @PreAuthorize("hasAnyAuthority('admin-modtube', 'super-admin')")
    public ResponseEntity<Map<String, String>> completeUpload(
            @RequestParam String videoId,
            @AuthenticationPrincipal LocalTubeUserDetails user) {
        try {
            Video video = videoService.getVideo(videoId).orElse(null);
            if (video == null) {
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "error",
                        "message", "Video not found"));
            }

            String extension = getFileExtension(video.getFilename());
            Path targetFile = uploadDir.resolve(videoId).resolve("original." + extension);

            if (!Files.exists(targetFile)) {
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "error",
                        "message", "Upload file not found"));
            }

            long fileSize = Files.size(targetFile);
            video.setFileSize(fileSize);

            videoService.updateVideoStatus(videoId, VideoStatus.UPLOADED);
            log.info("Upload completed for video {} (size: {} bytes)", videoId, fileSize);

            // Start transcoding
            transcodingService.transcodeToHLS(videoId, targetFile);

            return ResponseEntity.ok(Map.of(
                    "status", "completed",
                    "videoId", videoId,
                    "message", "Upload complete, transcoding started"
            ));

        } catch (IOException e) {
            log.error("Error completing upload for video {}", videoId, e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "status", "error",
                    "message", e.getMessage()));
        }
    }

    @GetMapping("/status/{videoId}")
    public ResponseEntity<Map<String, Object>> getUploadStatus(@PathVariable String videoId) {
        try {
            Video video = videoService.getVideo(videoId).orElse(null);
            if (video == null) {
                return ResponseEntity.notFound().build();
            }

            Map<String, Object> status = new HashMap<>();
            status.put("videoId", video.getId());
            status.put("status", video.getStatus() != null ? video.getStatus().name() : "UNKNOWN");
            status.put("progress", video.getProcessingProgress());
            status.put("qualities", video.getAvailableQualities());

            if (video.getStatus() == VideoStatus.READY) {
                status.put("hlsUrl", video.getMasterPlaylistUrl());
                status.put("thumbnailUrl", video.getThumbnailUrl());
            }

            if (video.getProcessingError() != null) {
                status.put("error", video.getProcessingError());
            }

            return ResponseEntity.ok(status);
        } catch (IOException e) {
            log.error("Error getting upload status for {}", videoId, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    private Map<String, Object> videoToMap(Video video) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", video.getId());
        map.put("title", video.getTitle());
        map.put("filename", video.getFilename());
        map.put("description", video.getDescription());
        map.put("uploaderName", video.getUploaderName());
        map.put("uploaderEmail", video.getUploaderEmail());
        map.put("status", video.getStatus() != null ? video.getStatus().name() : "UNKNOWN");
        map.put("visibility", video.getVisibility() != null ? video.getVisibility().name() : "PUBLIC");
        map.put("thumbnailUrl", video.getThumbnailUrl());
        map.put("hlsUrl", video.getMasterPlaylistUrl());
        map.put("qualities", video.getAvailableQualities());
        map.put("fileSize", video.getFileSize());
        map.put("duration", video.getDurationSeconds());
        map.put("views", video.getViews());
        map.put("likes", video.getLikes());
        map.put("tags", video.getTags());
        map.put("uploadedAt", video.getUploadedAt());
        return map;
    }

    private String getFileExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "mp4";
        }
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }
}