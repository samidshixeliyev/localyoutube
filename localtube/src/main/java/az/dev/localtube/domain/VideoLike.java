package az.dev.localtube.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VideoLike {

    private String id;
    private String videoId;
    private String userEmail;  // Changed from Long userId to String userEmail
    private Long createdAt;

    // Legacy field - keep for backward compatibility during migration
    @Deprecated
    private Long userId;

    /**
     * Generate a unique ID for the like using videoId and userEmail
     */
    public static String generateId(String videoId, String userEmail) {
        // Create a deterministic ID from videoId and userEmail
        return videoId + "_" + userEmail.replace("@", "_at_").replace(".", "_");
    }

    /**
     * Legacy method for backward compatibility
     */
    @Deprecated
    public static String generateId(String videoId, Long userId) {
        return videoId + "_" + userId;
    }
}