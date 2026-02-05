package az.dev.localtube.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Comment {

    private String id;
    private String videoId;
    private String userId;
    private String username;
    private String text;

    // Stored as Long (epoch milliseconds) in Elasticsearch
    private Long createdAt;
    private Long updatedAt;
    private Long likes;

    // Helper methods for date conversion
    @JsonIgnore
    public LocalDateTime getCreatedAtDateTime() {
        return createdAt != null ? LocalDateTime.ofInstant(Instant.ofEpochMilli(createdAt), ZoneId.systemDefault()) : null;
    }

    public void setCreatedAtDateTime(LocalDateTime dateTime) {
        this.createdAt = dateTime != null ? dateTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli() : null;
    }

    @JsonIgnore
    public LocalDateTime getUpdatedAtDateTime() {
        return updatedAt != null ? LocalDateTime.ofInstant(Instant.ofEpochMilli(updatedAt), ZoneId.systemDefault()) : null;
    }

    public void setUpdatedAtDateTime(LocalDateTime dateTime) {
        this.updatedAt = dateTime != null ? dateTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli() : null;
    }
}