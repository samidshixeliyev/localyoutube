package az.dev.localtube.domain;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "video_likes")
public class VideoLike {

    @Id
    @Column(name = "id", length = 255)
    private String id;

    @Column(name = "video_id", length = 64, nullable = false)
    private String videoId;

    @Column(name = "user_email", length = 255, nullable = false)
    private String userEmail;

    @Column(name = "created_at")
    private Long createdAt;

    public static String generateId(String videoId, String userEmail) {
        if (videoId == null || userEmail == null) {
            throw new IllegalArgumentException("videoId and userEmail cannot be null");
        }
        String normalizedEmail = userEmail.toLowerCase().trim();
        String sanitizedEmail = normalizedEmail
                .replace("@", "_at_")
                .replace(".", "_dot_")
                .replace("+", "_plus_")
                .replace("-", "_dash_");
        return videoId + "_" + sanitizedEmail;
    }
}
