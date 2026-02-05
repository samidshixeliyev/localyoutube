package az.dev.localtube.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

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

    // Stored as Long (epoch milliseconds) in Elasticsearch
    private Long createdAt;

    // Helper method for date conversion
    @JsonIgnore
    public LocalDateTime getCreatedAtDateTime() {
        return createdAt != null ? LocalDateTime.ofInstant(Instant.ofEpochMilli(createdAt), ZoneId.systemDefault()) : null;
    }

    public void setCreatedAtDateTime(LocalDateTime dateTime) {
        this.createdAt = dateTime != null ? dateTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli() : null;
    }

    /**
     * Generate composite ID from videoId and userId
     */
    public static String generateId(String videoId, Long userId) {
        return videoId + "_" + userId;
    }
}