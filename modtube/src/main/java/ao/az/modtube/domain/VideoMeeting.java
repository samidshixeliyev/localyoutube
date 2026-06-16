package ao.az.modtube.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "video_meetings")
@Getter @Setter @NoArgsConstructor
public class VideoMeeting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "room_code", nullable = false, unique = true)
    private String roomCode;

    @Column(name = "host_id")
    private Long hostId;

    @Column(name = "host_email", nullable = false)
    private String hostEmail;

    @Column(name = "host_name")
    private String hostName;

    /** SCHEDULED | LIVE | ENDED */
    @Column(nullable = false)
    private String status = "SCHEDULED";

    /** PUBLIC | RESTRICTED */
    @Column(nullable = false)
    private String visibility = "PUBLIC";

    /** Comma-separated email list for RESTRICTED meetings */
    @Column(name = "allowed_emails", columnDefinition = "TEXT")
    private String allowedEmails;

    /** Helper: splits allowedEmails into a live list. */
    public List<String> getAllowedEmailList() {
        if (allowedEmails == null || allowedEmails.isBlank()) return Collections.emptyList();
        return Arrays.stream(allowedEmails.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @PrePersist
    void onCreate() {
        if (roomCode == null) roomCode = UUID.randomUUID().toString();
        createdAt = LocalDateTime.now();
    }
}
