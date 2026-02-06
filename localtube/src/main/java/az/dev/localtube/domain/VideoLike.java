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
    private String userEmail;  // Primary field - email-based identification
    private Long createdAt;

    // Legacy field - keep for backward compatibility during migration
    @Deprecated
    private Long userId;

    /**
     * Generate a unique ID for the like using videoId and userEmail
     * IMPORTANT: This must be consistent and deterministic
     */
    public static String generateId(String videoId, String userEmail) {
        if (videoId == null || userEmail == null) {
            throw new IllegalArgumentException("videoId and userEmail cannot be null");
        }

        // Normalize email to lowercase for consistency
        String normalizedEmail = userEmail.toLowerCase().trim();

        // Create a deterministic ID from videoId and normalized email
        // Replace special characters that might cause issues
        String sanitizedEmail = normalizedEmail
                .replace("@", "_at_")
                .replace(".", "_dot_")
                .replace("+", "_plus_")
                .replace("-", "_dash_");

        return videoId + "_" + sanitizedEmail;
    }

    /**
     * Legacy method for backward compatibility
     */
    @Deprecated
    public static String generateId(String videoId, Long userId) {
        if (videoId == null || userId == null) {
            throw new IllegalArgumentException("videoId and userId cannot be null");
        }
        return videoId + "_user_" + userId;
    }
}