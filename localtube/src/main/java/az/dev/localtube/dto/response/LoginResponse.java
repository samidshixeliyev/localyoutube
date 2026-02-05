package az.dev.localtube.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Login response DTO - returned after successful authentication
 * Contains user info, JWT token, and role/permissions for frontend
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LoginResponse {

    /**
     * User's email address (primary identifier)
     */
    private String email;

    /**
     * User's first name
     */
    private String name;

    /**
     * User's full name (name + surname)
     */
    private String fullName;

    /**
     * JWT access token
     */
    private String accessToken;

    /**
     * Token type (always "Bearer")
     */
    @Builder.Default
    private String tokenType = "Bearer";

    /**
     * User's role name (e.g., "ADMIN", "USER")
     */
    private String role;

    /**
     * List of permission names user has
     * (e.g., ["admin-modtube", "VIDEO_VIEW", "VIDEO_COMMENT"])
     */
    private List<String> permissions;

    /**
     * User's database ID
     */
    private Long userId;
}