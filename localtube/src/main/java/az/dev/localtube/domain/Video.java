package az.dev.localtube.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Video {

    private String id;
    private String title;
    private String description;
    private String filename;
    private String originalFilename;

    // Uploader info
    private Long uploaderId;
    private String uploaderName;
    private String uploaderEmail;

    // Paths
    private String uploadPath;
    private String hlsPath;
    private String masterPlaylistUrl;
    private String thumbnailPath;
    private String thumbnailUrl;

    // Status
    private VideoStatus status;
    private Integer processingProgress;
    private String processingError;

    // Technical info
    @Builder.Default
    private List<String> availableQualities = new ArrayList<>();
    private Long fileSize;
    private Integer durationSeconds;
    private Integer width;
    private Integer height;
    private String codec;
    private Double frameRate;

    // Engagement
    @Builder.Default
    private Long views = 0L;
    @Builder.Default
    private Long likes = 0L;
    @Builder.Default
    private Integer commentCount = 0;

    // Tags
    @Builder.Default
    private List<String> tags = new ArrayList<>();
    // Visibility settings
// Visibility settings
    @Builder.Default
    private VideoVisibility visibility = VideoVisibility.PUBLIC;

    @Builder.Default
    private List<String> allowedEmails = new ArrayList<>();  // Email-based access for RESTRICTED

    private String restrictionNote;  // Optional note about restrictions  // Optional note about restrictions

    // Timestamps - stored as Long (epoch milliseconds) in Elasticsearch
    private Long uploadedAt;
    private Long processedAt;
    private Long updatedAt;

    // Helper methods for date conversion
    @JsonIgnore
    public LocalDateTime getUploadedAtDateTime() {
        return uploadedAt != null ? LocalDateTime.ofInstant(Instant.ofEpochMilli(uploadedAt), ZoneId.systemDefault()) : null;
    }

    public void setUploadedAtDateTime(LocalDateTime dateTime) {
        this.uploadedAt = dateTime != null ? dateTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli() : null;
    }

    @JsonIgnore
    public LocalDateTime getProcessedAtDateTime() {
        return processedAt != null ? LocalDateTime.ofInstant(Instant.ofEpochMilli(processedAt), ZoneId.systemDefault()) : null;
    }

    public void setProcessedAtDateTime(LocalDateTime dateTime) {
        this.processedAt = dateTime != null ? dateTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli() : null;
    }

    @JsonIgnore
    public LocalDateTime getUpdatedAtDateTime() {
        return updatedAt != null ? LocalDateTime.ofInstant(Instant.ofEpochMilli(updatedAt), ZoneId.systemDefault()) : null;
    }

    public void setUpdatedAtDateTime(LocalDateTime dateTime) {
        this.updatedAt = dateTime != null ? dateTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli() : null;
    }

    // Helper methods
    public void addQuality(String quality) {
        if (availableQualities == null) {
            availableQualities = new ArrayList<>();
        }
        if (!availableQualities.contains(quality)) {
            availableQualities.add(quality);
        }
    }

    public void incrementViews() {
        if (views == null) views = 0L;
        views++;
    }

    public void incrementLikes() {
        if (likes == null) likes = 0L;
        likes++;
    }

    public void decrementLikes() {
        if (likes == null) likes = 0L;
        if (likes > 0) likes--;
    }

    public void incrementCommentCount() {
        if (commentCount == null) commentCount = 0;
        commentCount++;
    }

    public void decrementCommentCount() {
        if (commentCount == null) commentCount = 0;
        if (commentCount > 0) commentCount--;
    }
}