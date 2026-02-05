package az.dev.localtube.dto;

import az.dev.localtube.domain.VideoStatus;
import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTOs for Video operations
 */
public class VideoDto {
    
    // ═══════════════════════════════════════════════════════════════════════
    // Request DTOs
    // ═══════════════════════════════════════════════════════════════════════
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InitUploadRequest {
        @NotBlank(message = "Filename is required")
        private String filename;
        
        @Size(max = 255, message = "Title must be less than 255 characters")
        private String title;
        
        @Size(max = 5000, message = "Description must be less than 5000 characters")
        private String description;
        
        @Positive(message = "Total size must be positive")
        private Long totalSize;
        
        @Positive(message = "Total chunks must be positive")
        private Integer totalChunks;
        
        private List<String> tags;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CompleteUploadRequest {
        @NotBlank(message = "Video ID is required")
        private String videoId;
        
        @NotBlank(message = "Filename is required")
        private String filename;
        
        @Positive(message = "Total chunks must be positive")
        private Integer totalChunks;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpdateVideoRequest {
        @Size(max = 255, message = "Title must be less than 255 characters")
        private String title;
        
        @Size(max = 5000, message = "Description must be less than 5000 characters")
        private String description;
        
        private List<String> tags;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SearchRequest {
        private String query;
        private VideoStatus status;
        private List<String> tags;
        private String uploaderId;
        private String sortBy;
        private String sortOrder;
        @Builder.Default
        private Integer page = 0;
        @Builder.Default
        private Integer size = 20;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // Response DTOs
    // ═══════════════════════════════════════════════════════════════════════
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InitUploadResponse {
        private String status;
        private String videoId;
        private String uploadId;
        private String message;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChunkUploadResponse {
        private String status;
        private Integer chunkIndex;
        private String progress;
        private String message;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CompleteUploadResponse {
        private String status;
        private String videoId;
        private String hlsUrl;
        private String message;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VideoResponse {
        private String id;
        private String title;
        private String description;
        
        // Uploader
        private Long uploaderId;
        private String uploaderName;
        
        // URLs
        private String hlsUrl;
        private String thumbnailUrl;
        
        // Status
        private String status;
        private Integer processingProgress;
        
        // Metadata
        private List<String> qualities;
        private Long fileSize;
        private Integer duration;
        private Integer width;
        private Integer height;
        
        // Engagement
        private Long views;
        private Long likes;
        private Integer commentCount;
        private Boolean isLikedByCurrentUser;
        
        // Tags
        private List<String> tags;
        
        // Timestamps
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime uploadedAt;
        
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime processedAt;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VideoListResponse {
        private List<VideoResponse> videos;
        private Long totalElements;
        private Integer totalPages;
        private Integer currentPage;
        private Integer pageSize;
        private Boolean hasNext;
        private Boolean hasPrevious;
    }
}