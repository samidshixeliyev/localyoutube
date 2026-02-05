package az.dev.localtube.controller;

import az.dev.localtube.domain.Video;
import az.dev.localtube.domain.VideoStatus;
import az.dev.localtube.service.TranscodingService;
import az.dev.localtube.service.VideoService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/upload")
public class UploadController {

    private final VideoService videoService;
    private final TranscodingService transcodingService;

    private final Path uploadDir;
    private final long maxFileSize;
    private final long minDiskFree;
    private static final int STREAM_BUFFER = 8 * 1024;

    private volatile long cachedFreeSpace = Long.MAX_VALUE;
    private volatile long cacheTimestamp = 0;
    private static final long CACHE_TTL_MS = 1_000;

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
            System.err.println("[Videos ERROR] " + e.getMessage());
            return ResponseEntity.status(500).body(
                    List.of(Map.of("error", "Failed to list videos: " + e.getMessage())));
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
                        "error", "File too large. Max " + (maxFileSize / (1024*1024*1024)) + " GB"));
            }

            cacheTimestamp = 0;
            long freeSpace = getFreeSpace();

            if (freeSpace < totalSize + minDiskFree) {
                return ResponseEntity.status(507).body(Map.of(
                        "error", "Not enough disk space"));
            }

            String videoTitle = title != null ? title : filename;
            String videoDesc = description != null ? description : "";

            Video video = videoService.createVideo(videoTitle, filename, videoDesc);

            return ResponseEntity.ok(Map.of(
                    "status", "initialized",
                    "videoId", video.getId(),
                    "uploadId", video.getId() + "_" + System.currentTimeMillis()
            ));

        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/chunk")
    public ResponseEntity<Map<String, Object>> uploadChunk(
            @RequestParam("file") MultipartFile chunk,
            @RequestParam int chunkIndex,
            @RequestParam int totalChunks,
            @RequestParam String filename) {

        try {
            String safeFilename = sanitizeFilename(filename);
            Path targetFile = uploadDir.resolve(safeFilename);

            if (getFreeSpace() < minDiskFree) {
                Files.deleteIfExists(targetFile);
                return ResponseEntity.status(507).body(Map.of(
                        "status", "error",
                        "message", "Disk space critically low"));
            }

            StandardOpenOption[] options = (chunkIndex == 0)
                    ? new StandardOpenOption[]{ StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING }
                    : new StandardOpenOption[]{ StandardOpenOption.CREATE, StandardOpenOption.APPEND };

            try (OutputStream out = Files.newOutputStream(targetFile, options);
                 InputStream in = chunk.getInputStream()) {
                byte[] buffer = new byte[STREAM_BUFFER];
                int n;
                while ((n = in.read(buffer)) != -1) {
                    out.write(buffer, 0, n);
                }
            }

            double progress = (double) (chunkIndex + 1) / totalChunks * 100;

            return ResponseEntity.ok(Map.of(
                    "status", "chunk_received",
                    "chunkIndex", chunkIndex,
                    "progress", String.format("%.1f%%", progress)
            ));

        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "status", "error",
                    "message", e.getMessage()));
        }
    }

    @PostMapping("/complete")
    public ResponseEntity<Map<String, Object>> completeUpload(
            @RequestParam String filename,
            @RequestParam int totalChunks) {

        try {
            String safeFilename = sanitizeFilename(filename);
            Path uploadedFile = uploadDir.resolve(safeFilename);

            if (!Files.exists(uploadedFile)) {
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "failed",
                        "message", "File not found"));
            }

            String videoId = safeFilename;
            if (videoId.contains(".")) {
                videoId = videoId.substring(0, videoId.lastIndexOf('.'));
            }

            transcodingService.transcodeToHLS(videoId, uploadedFile);

            return ResponseEntity.accepted().body(Map.of(
                    "status", "processing_started",
                    "videoId", videoId,
                    "hlsUrl", "/hls/" + videoId + "/master.m3u8"
            ));

        } catch (Exception e) {
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

    private String sanitizeFilename(String filename) {
        return filename.replaceAll("[^a-zA-Z0-9._-]", "_")
                .replaceAll("_+", "_")
                .replaceAll("^[._-]+", "");
    }

    private long getFreeSpace() {
        long now = System.currentTimeMillis();
        if (now - cacheTimestamp > CACHE_TTL_MS) {
            try {
                cachedFreeSpace = Files.getFileStore(uploadDir).getUsableSpace();
                cacheTimestamp = now;
            } catch (IOException e) {
                System.err.println("[DiskCheck] Failed: " + e.getMessage());
            }
        }
        return cachedFreeSpace;
    }

    private Map<String, Object> videoToMap(Video video) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", video.getId());
        map.put("name", video.getTitle());
        map.put("title", video.getTitle());
        map.put("description", video.getDescription());
        map.put("filename", video.getFilename());
        map.put("status", video.getStatus().name().toLowerCase());
        map.put("hlsUrl", video.getStatus() == VideoStatus.READY ? video.getMasterPlaylistUrl() : null);
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
}