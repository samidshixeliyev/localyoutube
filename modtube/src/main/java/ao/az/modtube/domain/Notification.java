package ao.az.modtube.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String userEmail;

    @Column(nullable = false)
    private String type;        // MEETING_INVITE | MEETING_STARTED

    @Column(nullable = false)
    private String title;

    private String message;

    private Long meetingId;

    /** Optional payload — e.g. a signed invite token for a one-click join link. */
    @Column(columnDefinition = "TEXT")
    private String data;

    @Column(nullable = false)
    private boolean read = false;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
    }
}
