package az.dev.localtube.controller;

import az.dev.localtube.domain.Video;
import az.dev.localtube.domain.VideoStatus;
import az.dev.localtube.service.VideoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/videos")
@RequiredArgsConstructor
public class VideoController {

    private final VideoService videoService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> listVideos(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            List<Video> videos = videoService.getPublicVideos(page, size);
            long total = videoService.countPublicVideos();

            return ResponseEntity.ok(Map.of(
                    "videos", videos.stream().map(this::toResponse).collect(Collectors.toList()),
                    "totalElements", total,
                    "totalPages", (int) Math.ceil((double) total / size),
                    "currentPage", page,
                    "pageSize", size
            ));
        } catch (IOException e) {
            log.error("Error listing videos", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/search")
    public ResponseEntity<Map<String, Object>> searchVideos(
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            List<Video> videos;
            if (query != null && !query.isBlank()) {
                videos = videoService.searchVideos(query, page, size);
            } else {
                videos = videoService.getPublicVideos(page, size);
            }

            return ResponseEntity.ok(Map.of(
                    "videos", videos.stream().map(this::toResponse).collect(Collectors.toList()),
                    "currentPage", page,
                    "pageSize", size
            ));
        } catch (IOException e) {
            log.error("Error searching videos", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getVideo(@PathVariable String id) {
        try {
            return videoService.getVideo(id)
                    .map(video -> ResponseEntity.ok(toResponse(video)))
                    .orElse(ResponseEntity.notFound().build());
        } catch (IOException e) {
            log.error("Error getting video", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/{id}/view")
    public ResponseEntity<Void> incrementView(@PathVariable String id) {
        try {
            videoService.incrementViews(id);
            return ResponseEntity.ok().build();
        } catch (IOException e) {
            log.error("Error incrementing view", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/{id}/like")
    public ResponseEntity<Void> likeVideo(@PathVariable String id) {
        try {
            videoService.incrementLikes(id);
            return ResponseEntity.ok().build();
        } catch (IOException e) {
            log.error("Error liking video", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @DeleteMapping("/{id}/like")
    public ResponseEntity<Void> unlikeVideo(@PathVariable String id) {
        try {
            videoService.decrementLikes(id);
            return ResponseEntity.ok().build();
        } catch (IOException e) {
            log.error("Error unliking video", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteVideo(@PathVariable String id) {
        try {
            videoService.deleteVideo(id);
            return ResponseEntity.ok().build();
        } catch (IOException e) {
            log.error("Error deleting video", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    private Map<String, Object> toResponse(Video video) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", video.getId());
        map.put("title", video.getTitle());
        map.put("description", video.getDescription());
        map.put("uploaderId", video.getUploaderId());
        map.put("uploaderName", video.getUploaderName());
        map.put("hlsUrl", video.getStatus() == VideoStatus.READY ? video.getMasterPlaylistUrl() : null);
        map.put("thumbnailUrl", video.getThumbnailUrl());
        map.put("status", video.getStatus() != null ? video.getStatus().name().toLowerCase() : null);
        map.put("qualities", video.getAvailableQualities());
        map.put("fileSize", video.getFileSize());
        map.put("duration", video.getDurationSeconds());
        map.put("width", video.getWidth());
        map.put("height", video.getHeight());
        map.put("views", video.getViews());
        map.put("likes", video.getLikes());
        map.put("commentCount", video.getCommentCount());
        map.put("tags", video.getTags());
        map.put("uploadedAt", video.getUploadedAt());
        map.put("processedAt", video.getProcessedAt());
        return map;
    }
}