package ao.az.modtube.domain;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "video_views",
    indexes = {
        @Index(name = "idx_view_video", columnList = "video_id"),
        @Index(name = "idx_view_user",  columnList = "user_email"),
        @Index(name = "idx_view_time",  columnList = "viewed_at"),
    })
@Data
@NoArgsConstructor
public class VideoView {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "video_id", nullable = false, length = 36)
    private String videoId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "user_email", length = 255)
    private String userEmail;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "viewed_at", nullable = false)
    private Instant viewedAt = Instant.now();

    public VideoView(String videoId, Long userId, String userEmail, String ipAddress) {
        this.videoId   = videoId;
        this.userId    = userId;
        this.userEmail = userEmail;
        this.ipAddress = ipAddress;
        this.viewedAt  = Instant.now();
    }
}
