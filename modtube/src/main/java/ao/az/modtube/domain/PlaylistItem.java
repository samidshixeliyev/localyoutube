package ao.az.modtube.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "playlist_items")
@Getter @Setter @NoArgsConstructor
public class PlaylistItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "playlist_id", nullable = false)
    private String playlistId;

    @Column(name = "video_id", nullable = false)
    private String videoId;

    @Column(nullable = false)
    private Integer position;

    @Column(name = "added_at")
    private LocalDateTime addedAt;

    @PrePersist
    void onCreate() { addedAt = LocalDateTime.now(); }

    public PlaylistItem(String playlistId, String videoId, int position) {
        this.playlistId = playlistId;
        this.videoId    = videoId;
        this.position   = position;
    }
}
