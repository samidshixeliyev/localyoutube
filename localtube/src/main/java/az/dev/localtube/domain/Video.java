package az.dev.localtube.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.domain.Persistable;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "videos")
public class Video implements Persistable<String> {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "title", length = 500)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "filename", length = 500)
    private String filename;

    @Column(name = "original_filename", length = 500)
    private String originalFilename;

    // Uploader info
    @Column(name = "uploader_id")
    private Long uploaderId;

    @Column(name = "uploader_name", length = 255)
    private String uploaderName;

    @Column(name = "uploader_email", length = 255)
    private String uploaderEmail;

    // Paths
    @Column(name = "upload_path", columnDefinition = "TEXT")
    private String uploadPath;

    @Column(name = "hls_path", columnDefinition = "TEXT")
    private String hlsPath;

    @Column(name = "master_playlist_url", columnDefinition = "TEXT")
    private String masterPlaylistUrl;

    @Column(name = "thumbnail_path", columnDefinition = "TEXT")
    private String thumbnailPath;

    @Column(name = "thumbnail_url", columnDefinition = "TEXT")
    private String thumbnailUrl;

    // Status
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 50)
    private VideoStatus status;

    @Column(name = "processing_progress")
    private Integer processingProgress;

    @Column(name = "processing_error", columnDefinition = "TEXT")
    private String processingError;

    // Technical info
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "video_qualities", joinColumns = @JoinColumn(name = "video_id"))
    @Column(name = "quality", length = 50)
    @Builder.Default
    private List<String> availableQualities = new ArrayList<>();

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Column(name = "width")
    private Integer width;

    @Column(name = "height")
    private Integer height;

    @Column(name = "codec", length = 50)
    private String codec;

    @Column(name = "frame_rate")
    private Double frameRate;

    // Engagement
    @Builder.Default
    @Column(name = "views")
    private Long views = 0L;

    @Builder.Default
    @Column(name = "likes")
    private Long likes = 0L;

    @Builder.Default
    @Column(name = "comment_count")
    private Integer commentCount = 0;

    // Tags
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "video_tags", joinColumns = @JoinColumn(name = "video_id"))
    @Column(name = "tag", length = 255)
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    // Visibility
    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(name = "visibility", length = 50)
    private VideoVisibility visibility = VideoVisibility.PUBLIC;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "video_allowed_emails", joinColumns = @JoinColumn(name = "video_id"))
    @Column(name = "email", length = 255)
    @Builder.Default
    private List<String> allowedEmails = new ArrayList<>();

    @Column(name = "restriction_note", columnDefinition = "TEXT")
    private String restrictionNote;

    // Timestamps as epoch millis (BIGINT in DB) for backward compat
    @Column(name = "uploaded_at")
    private Long uploadedAt;

    @Column(name = "processed_at")
    private Long processedAt;

    @Column(name = "updated_at")
    private Long updatedAt;

    // ───────────────────────────────────────────────────────────────
    // Persistable support — must tell JPA when this is a new entity
    // because we use manually-assigned String IDs
    // ───────────────────────────────────────────────────────────────
    @Transient
    private boolean newRecord = false;

    public void markAsNew() {
        this.newRecord = true;
    }

    @Override
    @JsonIgnore
    public boolean isNew() {
        return newRecord;
    }

    @PostPersist
    @PostLoad
    void clearNew() {
        this.newRecord = false;
    }

    // ───────────────────────────────────────────────────────────────
    // DateTime helpers (epoch millis ↔ LocalDateTime)
    // ───────────────────────────────────────────────────────────────
    @JsonIgnore
    public LocalDateTime getUploadedAtDateTime() {
        return uploadedAt != null
                ? LocalDateTime.ofInstant(Instant.ofEpochMilli(uploadedAt), ZoneId.systemDefault())
                : null;
    }

    public void setUploadedAtDateTime(LocalDateTime dateTime) {
        this.uploadedAt = dateTime != null
                ? dateTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                : null;
    }

    @JsonIgnore
    public LocalDateTime getProcessedAtDateTime() {
        return processedAt != null
                ? LocalDateTime.ofInstant(Instant.ofEpochMilli(processedAt), ZoneId.systemDefault())
                : null;
    }

    public void setProcessedAtDateTime(LocalDateTime dateTime) {
        this.processedAt = dateTime != null
                ? dateTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                : null;
    }

    @JsonIgnore
    public LocalDateTime getUpdatedAtDateTime() {
        return updatedAt != null
                ? LocalDateTime.ofInstant(Instant.ofEpochMilli(updatedAt), ZoneId.systemDefault())
                : null;
    }

    public void setUpdatedAtDateTime(LocalDateTime dateTime) {
        this.updatedAt = dateTime != null
                ? dateTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                : null;
    }

    // ───────────────────────────────────────────────────────────────
    // Mutation helpers
    // ───────────────────────────────────────────────────────────────
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
