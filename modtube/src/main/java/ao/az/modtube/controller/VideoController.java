package ao.az.modtube.controller;

import ao.az.modtube.config.security.ModTubePrincipal;
import ao.az.modtube.domain.Comment;
import ao.az.modtube.domain.Video;
import ao.az.modtube.domain.VideoStatus;
import ao.az.modtube.domain.VideoView;
import ao.az.modtube.domain.VideoVisibility;
import ao.az.modtube.metrics.ModTubeMetrics;
import ao.az.modtube.repository.VideoViewRepository;
import ao.az.modtube.service.CommentService;
import ao.az.modtube.service.VideoService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import org.springframework.data.domain.PageRequest;

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
    private final CommentService commentService;
    private final ModTubeMetrics metrics;
    private final VideoViewRepository videoViewRepository;

    @GetMapping
    public ResponseEntity<Map<String, Object>> listVideos(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal ModTubePrincipal user) {
        try {
            if (user != null && user.isSuperAdmin()) {
                List<Video> allVideos = videoService.getAllReadyVideos(page, size);
                long total = videoService.countAllReadyVideos();
                return ResponseEntity.ok(Map.of(
                        "videos", allVideos.stream().map(v -> toResponse(v, user)).collect(Collectors.toList()),
                        "totalElements", total,
                        "totalPages", (int) Math.ceil((double) total / size),
                        "currentPage", page,
                        "pageSize", size
                ));
            }
            String userEmail = user != null ? user.getEmail() : null;
            List<Video> allVideos = videoService.getPublicVideos(page, size, userEmail);
            List<Video> visibleVideos = allVideos.stream()
                    .filter(video -> canViewVideo(video, user))
                    .collect(Collectors.toList());
            long total = videoService.countPublicVideos(userEmail);
            return ResponseEntity.ok(Map.of(
                    "videos", visibleVideos.stream().map(v -> toResponse(v, user)).collect(Collectors.toList()),
                    "totalElements", total,
                    "totalPages", (int) Math.ceil((double) total / size),
                    "currentPage", page,
                    "pageSize", size
            ));
        } catch (Exception e) {
            log.error("Error listing videos", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/suggestions")
    public ResponseEntity<List<String>> getTitleSuggestions(
            @RequestParam String query,
            @RequestParam(defaultValue = "8") int size) {
        try {
            if (query == null || query.isBlank()) return ResponseEntity.ok(List.of());
            List<String> titles = videoService.getTitleSuggestions(query, size);
            return ResponseEntity.ok(titles);
        } catch (Exception e) {
            log.error("Error getting title suggestions", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/shorts")
    public ResponseEntity<Map<String, Object>> getShorts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size,
            @AuthenticationPrincipal ModTubePrincipal user) {
        try {
            List<Video> shorts = videoService.getShorts(page, size, user != null ? user.getEmail() : null);
            return ResponseEntity.ok(Map.of(
                    "videos", shorts.stream().map(v -> toResponse(v, user)).collect(Collectors.toList()),
                    "currentPage", page,
                    "pageSize", size
            ));
        } catch (Exception e) {
            log.error("Error getting shorts", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/search")
    public ResponseEntity<Map<String, Object>> searchVideos(
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal ModTubePrincipal user) {
        try {
            String userEmail = user != null ? user.getEmail() : null;
            List<Video> videos;
            if (query != null && !query.isBlank()) {
                videos = videoService.searchVideos(query, page, size, userEmail);
            } else {
                videos = videoService.getPublicVideos(page, size, userEmail);
            }
            List<Video> visibleVideos = videos.stream()
                    .filter(video -> canViewVideo(video, user))
                    .collect(Collectors.toList());
            return ResponseEntity.ok(Map.of(
                    "videos", visibleVideos.stream().map(v -> toResponse(v, user)).collect(Collectors.toList()),
                    "currentPage", page,
                    "pageSize", size
            ));
        } catch (Exception e) {
            log.error("Error searching videos", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getVideo(
            @PathVariable String id,
            @AuthenticationPrincipal ModTubePrincipal user) {
        try {
            var videoOpt = videoService.getVideo(id);
            if (videoOpt.isEmpty()) return ResponseEntity.notFound().build();
            Video video = videoOpt.get();
            if (user != null && user.isSuperAdmin()) return ResponseEntity.ok(toResponse(video, user));
            if (!canViewVideo(video, user)) {
                return ResponseEntity.status(403).body(Map.of("error", "You don't have permission to view this video"));
            }
            return ResponseEntity.ok(toResponse(video, user));
        } catch (Exception e) {
            log.error("Error getting video", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/{id}/suggestions")
    public ResponseEntity<Map<String, Object>> getSuggestions(
            @PathVariable String id,
            @RequestParam(defaultValue = "10") int size) {
        try {
            var videoOpt = videoService.getVideo(id);
            if (videoOpt.isEmpty()) return ResponseEntity.notFound().build();
            Video video = videoOpt.get();
            List<Video> suggestions = videoService.getSuggestionsByTags(video.getTags(), id, size);
            return ResponseEntity.ok(Map.of(
                    "videos", suggestions.stream().map(v -> toResponse(v, null)).collect(Collectors.toList())
            ));
        } catch (Exception e) {
            log.error("Error getting suggestions", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/{id}/view")
    public ResponseEntity<Void> incrementView(
            @PathVariable String id,
            @AuthenticationPrincipal ModTubePrincipal principal,
            HttpServletRequest request) {
        try {
            videoService.incrementViews(id);
            metrics.recordVideoView();
            String ip = request.getHeader("X-Forwarded-For");
            if (ip != null && ip.contains(",")) ip = ip.split(",")[0].trim();
            if (ip == null) ip = request.getRemoteAddr();
            Long userId = principal != null ? principal.getUserId() : null;
            String email = principal != null ? principal.getEmail() : null;
            videoViewRepository.save(new VideoView(id, userId, email, ip));
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Error incrementing view", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/{id}/like")
    public ResponseEntity<Map<String, Object>> likeVideo(
            @PathVariable String id,
            @AuthenticationPrincipal ModTubePrincipal user) {
        try {
            if (user == null) return ResponseEntity.status(401).body(Map.of("error", "Please login to like videos"));
            boolean success = videoService.toggleLike(id, user.getEmail());
            var video = videoService.getVideo(id).orElseThrow();
            return ResponseEntity.ok(Map.of("liked", success, "likes", video.getLikes()));
        } catch (Exception e) {
            log.error("Error toggling like", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/{id}/like-status")
    public ResponseEntity<Map<String, Boolean>> getLikeStatus(
            @PathVariable String id,
            @AuthenticationPrincipal ModTubePrincipal user) {
        try {
            if (user == null) return ResponseEntity.ok(Map.of("liked", false));
            boolean liked = videoService.isLikedByUser(id, user.getEmail());
            return ResponseEntity.ok(Map.of("liked", liked));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @DeleteMapping("/{id}/like")
    public ResponseEntity<Map<String, Object>> unlikeVideo(
            @PathVariable String id,
            @AuthenticationPrincipal ModTubePrincipal user) {
        try {
            if (user == null) return ResponseEntity.status(401).body(Map.of("error", "Please login"));
            if (videoService.isLikedByUser(id, user.getEmail())) {
                videoService.removeLike(id, user.getEmail());
            }
            var video = videoService.getVideo(id).orElseThrow();
            return ResponseEntity.ok(Map.of("liked", false, "likes", video.getLikes()));
        } catch (Exception e) {
            log.error("Error removing like", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('delete-video', 'admin-modtube', 'super-admin')")
    public ResponseEntity<?> deleteVideo(
            @PathVariable String id,
            @AuthenticationPrincipal ModTubePrincipal user) {
        try {
            var video = videoService.getVideo(id).orElse(null);
            if (video == null) return ResponseEntity.notFound().build();
            boolean isOwner = video.getUploaderEmail() != null
                    && video.getUploaderEmail().equalsIgnoreCase(user.getEmail());
            if (!isOwner && !user.isSuperAdmin()) {
                return ResponseEntity.status(403).body(Map.of("error", "You can only delete your own videos"));
            }
            videoService.deleteVideo(id);
            return ResponseEntity.ok().build();
        } catch (IOException e) {
            log.error("Error deleting video", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/{id}/thumbnail")
    @PreAuthorize("hasAnyAuthority('admin-modtube', 'super-admin')")
    public ResponseEntity<Map<String, String>> uploadThumbnail(
            @PathVariable String id,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal ModTubePrincipal user) {
        try {
            var video = videoService.getVideo(id).orElse(null);
            if (video == null) return ResponseEntity.notFound().build();
            boolean isOwner = video.getUploaderEmail() != null &&
                    video.getUploaderEmail().equalsIgnoreCase(user.getEmail());
            if (!isOwner && !user.isSuperAdmin()) {
                return ResponseEntity.status(403).body(Map.of("status", "error", "message", "You can only upload thumbnails for your own videos"));
            }
            videoService.uploadCustomThumbnail(id, file);
            return ResponseEntity.ok(Map.of("status", "success", "message", "Thumbnail uploaded successfully", "thumbnailUrl", "/thumbnails/" + id + "/custom.jpg"));
        } catch (IOException e) {
            log.error("Error uploading thumbnail", e);
            return ResponseEntity.internalServerError().body(Map.of("status", "error", "message", "Failed to upload thumbnail"));
        }
    }

    @GetMapping("/{id}/comments")
    public ResponseEntity<Map<String, Object>> getComments(
            @PathVariable String id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            List<Comment> comments = commentService.getVideoComments(id, page, size);
            long total = commentService.countVideoComments(id);
            return ResponseEntity.ok(Map.of("comments", comments, "totalElements", total, "currentPage", page, "pageSize", size));
        } catch (Exception e) {
            log.error("Error getting comments", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<Comment> addComment(
            @PathVariable String id,
            @RequestBody Map<String, String> request,
            @AuthenticationPrincipal ModTubePrincipal user) {
        try {
            if (user == null) return ResponseEntity.status(401).build();
            var video = videoService.getVideo(id).orElse(null);
            if (video == null) return ResponseEntity.notFound().build();
            String text = request.get("text");
            if (text == null || text.isBlank()) return ResponseEntity.badRequest().build();
            Comment comment = commentService.addComment(id, user.getEmail(), user.getUsername(), text);
            return ResponseEntity.ok(comment);
        } catch (Exception e) {
            log.error("Error adding comment", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @DeleteMapping("/{videoId}/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(
            @PathVariable String videoId,
            @PathVariable String commentId,
            @AuthenticationPrincipal ModTubePrincipal user) {
        try {
            if (user == null) return ResponseEntity.status(401).build();
            var comment = commentService.getComment(commentId).orElse(null);
            if (comment == null) return ResponseEntity.notFound().build();
            boolean isOwner = comment.getUserId().equals(user.getEmail());
            boolean isAdmin = user.hasPermission("admin-modtube") || user.isSuperAdmin();
            if (!isOwner && !isAdmin) return ResponseEntity.status(403).build();
            commentService.deleteComment(commentId, videoId);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Error deleting comment", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('admin-modtube', 'super-admin')")
    public ResponseEntity<?> updateVideo(
            @PathVariable String id,
            @RequestBody Map<String, Object> updates,
            @AuthenticationPrincipal ModTubePrincipal user) {
        try {
            var video = videoService.getVideo(id).orElse(null);
            if (video == null) return ResponseEntity.notFound().build();
            boolean isOwner = video.getUploaderEmail() != null
                    && video.getUploaderEmail().equalsIgnoreCase(user.getEmail());
            if (!isOwner && !user.isSuperAdmin()) {
                return ResponseEntity.status(403).body(Map.of("error", "You can only edit your own videos"));
            }
            if (updates.containsKey("title")) video.setTitle((String) updates.get("title"));
            if (updates.containsKey("description")) video.setDescription((String) updates.get("description"));
            if (updates.containsKey("tags")) {
                @SuppressWarnings("unchecked")
                List<String> tags = (List<String>) updates.get("tags");
                video.setTags(tags);
            }
            if (updates.containsKey("isShorts")) {
                video.setShort(Boolean.TRUE.equals(updates.get("isShorts")));
            }
            videoService.updateVideo(video);
            return ResponseEntity.ok(toResponse(video, user));
        } catch (Exception e) {
            log.error("Error updating video", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/{id}/privacy")
    @PreAuthorize("hasAnyAuthority('admin-modtube', 'super-admin')")
    public ResponseEntity<?> setVideoPrivacy(
            @PathVariable String id,
            @RequestBody Map<String, Object> privacySettings,
            @AuthenticationPrincipal ModTubePrincipal user) {
        try {
            var video = videoService.getVideo(id).orElse(null);
            if (video == null) return ResponseEntity.notFound().build();
            boolean isOwner = video.getUploaderEmail() != null
                    && video.getUploaderEmail().equalsIgnoreCase(user.getEmail());
            if (!isOwner && !user.isSuperAdmin()) {
                return ResponseEntity.status(403).body(Map.of("error", "You can only change privacy settings for your own videos"));
            }
            String visibility = (String) privacySettings.get("visibility");
            if (visibility != null) video.setVisibility(VideoVisibility.valueOf(visibility.toUpperCase()));
            if (privacySettings.containsKey("allowedUserEmails")) {
                @SuppressWarnings("unchecked")
                List<String> emails = (List<String>) privacySettings.get("allowedUserEmails");
                video.setAllowedEmails(emails);
            }
            if (privacySettings.containsKey("restrictionNote")) {
                video.setRestrictionNote((String) privacySettings.get("restrictionNote"));
            }
            videoService.updateVideo(video);
            return ResponseEntity.ok(Map.of("message", "Privacy settings updated", "visibility", video.getVisibility()));
        } catch (Exception e) {
            log.error("Error updating privacy", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/{id}/share")
    public ResponseEntity<Map<String, String>> shareVideo(@PathVariable String id) {
        try {
            var video = videoService.getVideo(id).orElse(null);
            if (video == null) return ResponseEntity.notFound().build();
            return ResponseEntity.ok(Map.of("shareUrl", "/video/" + id, "title", video.getTitle(), "videoId", id));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private boolean canViewVideo(Video video, ModTubePrincipal user) {
        if (video.getVisibility() == null) return true;
        if (user != null && user.isSuperAdmin()) return true;
        switch (video.getVisibility()) {
            case PUBLIC: return true;
            case PRIVATE: return user != null && (user.hasPermission("admin-modtube") || user.isSuperAdmin());
            case UNLISTED: return true;
            case RESTRICTED: {
                if (user == null) return false;
                boolean isAdmin = user.hasPermission("admin-modtube");
                boolean isInAllowedList = video.getAllowedEmails() != null &&
                        video.getAllowedEmails().stream().anyMatch(email -> email.equalsIgnoreCase(user.getEmail()));
                return isAdmin || isInAllowedList;
            }
            default: return true;
        }
    }

    private Map<String, Object> toResponse(Video video, ModTubePrincipal user) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", video.getId());
        map.put("title", video.getTitle());
        map.put("description", video.getDescription());
        map.put("uploaderId", video.getUploaderId());
        map.put("uploaderName", video.getUploaderName());
        map.put("uploaderEmail", video.getUploaderEmail());
        map.put("hlsUrl", video.getStatus() == VideoStatus.READY ? video.getMasterPlaylistUrl() : null);
        map.put("thumbnailUrl", video.getThumbnailUrl());
        map.put("status", video.getStatus() != null ? video.getStatus().name().toLowerCase() : null);
        map.put("visibility", video.getVisibility() != null ? video.getVisibility().name().toLowerCase() : "public");
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
        map.put("allowedEmails", video.getAllowedEmails());
        map.put("isShort", video.isShort());

        if (user != null) {
            map.put("isLikedByCurrentUser", videoService.isLikedByUser(video.getId(), user.getEmail()));
            boolean isOwner = video.getUploaderEmail() != null
                    && video.getUploaderEmail().equalsIgnoreCase(user.getEmail());
            map.put("canEdit",   user.isSuperAdmin() || (user.hasPermission("admin-modtube") && isOwner));
            map.put("canDelete", user.isSuperAdmin()
                    || (isOwner && (user.hasPermission("delete-video") || user.hasPermission("admin-modtube"))));
        } else {
            map.put("isLikedByCurrentUser", false);
            map.put("canEdit",   false);
            map.put("canDelete", false);
        }
        return map;
    }
}
