package ao.az.modtube.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@Entity
@Table(name = "playlists")
@Getter @Setter @NoArgsConstructor
public class Playlist {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "owner_id")
    private Long ownerId;

    @Column(name = "owner_email", nullable = false)
    private String ownerEmail;

    /** PUBLIC | PRIVATE | RESTRICTED */
    @Column(nullable = false)
    private String visibility = "PUBLIC";

    /** Comma-separated email list for RESTRICTED playlists */
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

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (id == null) id = java.util.UUID.randomUUID().toString();
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void onUpdate() { updatedAt = LocalDateTime.now(); }
}
