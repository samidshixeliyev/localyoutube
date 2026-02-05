package az.dev.localtube.domain;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * VideoLike domain model - stored in Elasticsearch
 * Tracks which users liked which videos (for preventing duplicate likes)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VideoLike {
    
    private String id;
    private String videoId;
    private Long userId;
    private String userEmail;
    
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;
    
    /**
     * Generate composite ID from videoId and userId
     */
    public static String generateId(String videoId, Long userId) {
        return videoId + "_" + userId;
    }
}