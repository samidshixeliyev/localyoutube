package az.dev.localtube.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTOs for Comment operations
 */
public class CommentDto {
    
    // ═══════════════════════════════════════════════════════════════════════
    // Request DTOs
    // ═══════════════════════════════════════════════════════════════════════
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateCommentRequest {
        @NotBlank(message = "Comment text is required")
        @Size(min = 1, max = 2000, message = "Comment must be between 1 and 2000 characters")
        private String text;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpdateCommentRequest {
        @NotBlank(message = "Comment text is required")
        @Size(min = 1, max = 2000, message = "Comment must be between 1 and 2000 characters")
        private String text;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // Response DTOs
    // ═══════════════════════════════════════════════════════════════════════
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CommentResponse {
        private String id;
        private String videoId;
        private Long userId;
        private String username;
        private String userAvatarUrl;
        private String text;
        private Long likes;
        private Boolean isLikedByCurrentUser;
        private Boolean isOwnComment;
        
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime createdAt;
        
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime updatedAt;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CommentListResponse {
        private List<CommentResponse> comments;
        private Long totalElements;
        private Integer totalPages;
        private Integer currentPage;
        private Integer pageSize;
        private Boolean hasNext;
        private Boolean hasPrevious;
    }
}