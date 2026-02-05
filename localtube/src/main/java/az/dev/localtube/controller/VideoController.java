package az.dev.localtube.controller;

import az.dev.localtube.config.security.LocalTubeUserDetails;
import az.dev.localtube.domain.VideoStatus;
import az.dev.localtube.dto.ApiResponse;
import az.dev.localtube.dto.VideoDto.*;
import az.dev.localtube.service.UserService;
import az.dev.localtube.service.VideoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;

/**
 * Video REST API Controller
 * 
 * Public endpoints: GET operations for browsing/viewing
 * Authenticated endpoints: POST/PUT/DELETE for modifications
 */
@Slf4j
@RestController
@RequestMapping("/api/videos")
@RequiredArgsConstructor
public class VideoController {

    private final VideoService videoService;

    // ═══════════════════════════════════════════════════════════════════════════════
    // Public Endpoints (No Authentication Required)
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * GET /api/videos - List all public videos
     */
    @GetMapping
    public ResponseEntity<ApiResponse<VideoListResponse>> listVideos(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) throws IOException {
        VideoListResponse response = videoService.getPublicVideos(page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * GET /api/videos/search - Search videos
     */
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<VideoListResponse>> searchVideos(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) List<String> tags,
            @RequestParam(defaultValue = "uploadedAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortOrder,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) throws IOException {
        SearchRequest request = SearchRequest.builder()
                .query(query)
                .tags(tags)
                .status(VideoStatus.READY)
                .sortBy(sortBy)
                .sortOrder(sortOrder)
                .page(page)
                .size(size)
                .build();

        Long currentUserId = UserService.getCurrentUserId();
        VideoListResponse response = videoService.searchVideos(request, currentUserId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * GET /api/videos/{id} - Get video details
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<VideoResponse>> getVideo(@PathVariable String id) 
            throws IOException {
        Long currentUserId = UserService.getCurrentUserId();
        VideoResponse response = videoService.getVideoWithLikeStatus(id, currentUserId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * POST /api/videos/{id}/view - Increment view count
     */
    @PostMapping("/{id}/view")
    public ResponseEntity<ApiResponse<Void>> incrementView(@PathVariable String id) 
            throws IOException {
        videoService.incrementViews(id);
        return ResponseEntity.ok(ApiResponse.success("View recorded"));
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // Authenticated Endpoints (JWT Required)
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * PUT /api/videos/{id} - Update video
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<VideoResponse>> updateVideo(
            @PathVariable String id,
            @Valid @RequestBody UpdateVideoRequest request,
            @AuthenticationPrincipal LocalTubeUserDetails user
    ) throws IOException {
        var video = videoService.updateVideo(id, request, user);
        Long currentUserId = user.getUserId();
        VideoResponse response = videoService.getVideoWithLikeStatus(id, currentUserId);
        return ResponseEntity.ok(ApiResponse.success(response, "Video updated"));
    }

    /**
     * DELETE /api/videos/{id} - Delete video
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteVideo(
            @PathVariable String id,
            @AuthenticationPrincipal LocalTubeUserDetails user
    ) throws IOException {
        videoService.deleteVideo(id, user);
        return ResponseEntity.ok(ApiResponse.success("Video deleted"));
    }

    /**
     * POST /api/videos/{id}/like - Like video
     */
    @PostMapping("/{id}/like")
    public ResponseEntity<ApiResponse<Void>> likeVideo(
            @PathVariable String id,
            @AuthenticationPrincipal LocalTubeUserDetails user
    ) throws IOException {
        videoService.likeVideo(id, user);
        return ResponseEntity.ok(ApiResponse.success("Video liked"));
    }

    /**
     * DELETE /api/videos/{id}/like - Unlike video
     */
    @DeleteMapping("/{id}/like")
    public ResponseEntity<ApiResponse<Void>> unlikeVideo(
            @PathVariable String id,
            @AuthenticationPrincipal LocalTubeUserDetails user
    ) throws IOException {
        videoService.unlikeVideo(id, user);
        return ResponseEntity.ok(ApiResponse.success("Video unliked"));
    }

    /**
     * GET /api/videos/my - Get current user's videos
     */
    @GetMapping("/my")
    public ResponseEntity<ApiResponse<VideoListResponse>> getMyVideos(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal LocalTubeUserDetails user
    ) throws IOException {
        VideoListResponse response = videoService.getVideosByUploader(user.getUserId(), page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}