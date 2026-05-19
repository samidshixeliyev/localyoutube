package ao.az.modtube.controller;

import ao.az.modtube.config.security.ModTubePrincipal;
import ao.az.modtube.config.security.ModTubeUserDetails;
import ao.az.modtube.domain.Video;
import ao.az.modtube.domain.VideoStatus;
import ao.az.modtube.metrics.ModTubeMetrics;
import ao.az.modtube.service.TranscodingService;
import ao.az.modtube.service.VideoService;
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
import java.util.Comparator;
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
    private final ModTubeMetrics metrics;
    private final Path uploadDir;
    private final long maxFileSize;
    private final long minDiskFree;

    private static final int MAX_CHUNK_SIZE = 55 * 1024 * 1024; // 55 MB ceiling (frontend max chunk is 50 MB)

    public UploadController(VideoService videoService,
                            TranscodingService transcodingService,
                            ModTubeMetrics metrics,
                            @Value("${modtube.storage.upload-dir}") String uploadDirPath,
                            @Value("${modtube.storage.max-file-size}") long maxFileSize,
                            @Value("${modtube.storage.min-disk-free}") long minDiskFree) throws IOException {
        this.videoService = videoService;
        this.transcodingService = transcodingService;
        this.metrics = metrics;
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
        } catch (Exception e) {
            log.error("Error listing videos", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/init")
    @PreAuthorize("hasAnyAuthority('upload-video', 'admin-modtube', 'super-admin')")
    public ResponseEntity<Map<String, String>> initUpload(
            @RequestParam String filename,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String description,
            @RequestParam long totalSize,
            @RequestParam int totalChunks,
            @AuthenticationPrincipal ModTubeUserDetails user) {

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

            metrics.recordUploadAttempt();

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
    @PreAuthorize("hasAnyAuthority('upload-video', 'admin-modtube', 'super-admin')")
    public ResponseEntity<Map<String, Object>> uploadChunk(
            @RequestParam("file") MultipartFile chunk,
            @RequestParam int chunkIndex,
            @RequestParam int totalChunks,
            @RequestParam String videoId,
            @AuthenticationPrincipal ModTubePrincipal user) {

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

            // Write each chunk to its own file — parallel workers can arrive out of order
            // and simple APPEND would corrupt the file. Chunks are merged in order at complete().
            Path chunkFile = videoDir.resolve("chunk_" + chunkIndex + ".bin");
            try (InputStream inputStream = chunk.getInputStream();
                 OutputStream outputStream = Files.newOutputStream(chunkFile,
                         StandardOpenOption.CREATE, StandardOpenOption.WRITE, StandardOpenOption.TRUNCATE_EXISTING)) {
                byte[] buffer = new byte[65536];
                int bytesRead;
                while ((bytesRead = inputStream.read(buffer)) != -1) {
                    outputStream.write(buffer, 0, bytesRead);
                }
                outputStream.flush();
            }

            // Log at INFO at every 10% milestone (and always on first/last chunk)
            int prevPct = (int) ((double) chunkIndex / totalChunks * 100);
            int curPct  = (int) ((double) (chunkIndex + 1) / totalChunks * 100);
            if (chunkIndex == 0 || chunkIndex == totalChunks - 1 || curPct / 10 > prevPct / 10) {
                log.info("[Upload] video={} chunk {}/{} ({}%)", videoId, chunkIndex + 1, totalChunks, curPct);
            }

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
    @PreAuthorize("hasAnyAuthority('upload-video', 'admin-modtube', 'super-admin')")
    public ResponseEntity<Map<String, String>> completeUpload(
            @RequestParam String videoId,
            @AuthenticationPrincipal ModTubePrincipal user) {
        try {
            Video video = videoService.getVideo(videoId).orElse(null);
            if (video == null) {
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "error",
                        "message", "Video not found"));
            }

            String extension = getFileExtension(video.getFilename());
            Path videoDir    = uploadDir.resolve(videoId);
            Path targetFile  = videoDir.resolve("original." + extension);

            // Merge chunk files in strict index order — avoids corruption from parallel uploads
            List<Path> chunkFiles;
            try (var stream = Files.list(videoDir)) {
                chunkFiles = stream
                    .filter(p -> p.getFileName().toString().matches("chunk_\\d+\\.bin"))
                    .sorted(Comparator.comparingInt(p ->
                        Integer.parseInt(p.getFileName().toString()
                            .replace("chunk_", "").replace(".bin", ""))))
                    .collect(Collectors.toList());
            }

            if (chunkFiles.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "error",
                        "message", "No upload chunks found — upload may have failed"));
            }

            try (OutputStream out = Files.newOutputStream(targetFile,
                    StandardOpenOption.CREATE, StandardOpenOption.WRITE,
                    StandardOpenOption.TRUNCATE_EXISTING)) {
                for (Path cf : chunkFiles) {
                    Files.copy(cf, out);
                    Files.delete(cf);
                }
                out.flush();
            }
            log.info("[Upload] Merged {} chunks into {} for video={}", chunkFiles.size(), targetFile.getFileName(), videoId);

            long fileSize = Files.size(targetFile);
            video.setFileSize(fileSize);

            videoService.updateVideoStatus(videoId, VideoStatus.UPLOADED);
            log.info("Upload completed for video {} (size: {} bytes)", videoId, fileSize);
            metrics.recordUploadSuccess();

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

    @DeleteMapping("/cancel/{videoId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, String>> cancelUpload(
            @PathVariable String videoId,
            @AuthenticationPrincipal ModTubeUserDetails user) {
        try {
            Video video = videoService.getVideo(videoId).orElse(null);
            if (video == null) {
                return ResponseEntity.notFound().build();
            }

            boolean isOwner = user != null && user.getUserId().equals(video.getUploaderId());
            boolean isAdmin = user != null && (user.isSuperAdmin() || user.isAdmin());
            if (!isOwner && !isAdmin) {
                return ResponseEntity.status(403).body(Map.of("error", "Icazə yoxdur"));
            }

            transcodingService.cancelTranscoding(videoId);
            videoService.deleteVideo(videoId);

            log.info("[Upload] Cancelled video={} by user={}", videoId,
                     user != null ? user.getEmail() : "unknown");
            return ResponseEntity.ok(Map.of("status", "cancelled", "videoId", videoId));

        } catch (Exception e) {
            log.error("Error cancelling upload for video {}", videoId, e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
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
            status.put("progress", video.getProcessingProgress() != null ? video.getProcessingProgress() : 0);
            status.put("qualities", video.getAvailableQualities());
            status.put("stage", transcodingService.getProcessingStage(video.getId()));
            Map<String, Integer> qp = transcodingService.getQualityProgress(video.getId());
            if (!qp.isEmpty()) status.put("qualityProgress", qp);

            if (video.getStatus() == VideoStatus.READY) {
                status.put("hlsUrl", video.getMasterPlaylistUrl());
                status.put("thumbnailUrl", video.getThumbnailUrl());
            }

            if (video.getProcessingError() != null) {
                status.put("error", video.getProcessingError());
            }

            return ResponseEntity.ok(status);
        } catch (Exception e) {
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