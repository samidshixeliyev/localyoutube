package az.dev.modtube.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
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
@Entity
@Table(name = "comments")
public class Comment {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "video_id", length = 64)
    private String videoId;

    @Column(name = "user_id", length = 255)
    private String userId;

    @Column(name = "username", length = 255)
    private String username;

    @Column(name = "text", columnDefinition = "TEXT")
    private String text;

    @Builder.Default
    @Column(name = "likes")
    private Long likes = 0L;

    @Column(name = "created_at")
    private Long createdAt;

    @Column(name = "updated_at")
    private Long updatedAt;

    @JsonIgnore
    public LocalDateTime getCreatedAtDateTime() {
        return createdAt != null
                ? LocalDateTime.ofInstant(Instant.ofEpochMilli(createdAt), ZoneId.systemDefault())
                : null;
    }

    public void setCreatedAtDateTime(LocalDateTime dateTime) {
        this.createdAt = dateTime != null
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
}
