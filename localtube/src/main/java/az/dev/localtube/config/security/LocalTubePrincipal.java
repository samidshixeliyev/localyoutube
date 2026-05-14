package az.dev.localtube.config.security;

import org.springframework.security.core.userdetails.UserDetails;

/**
 * Common interface for both locally-authenticated users (LocalTubeUserDetails)
 * and IDP-authenticated users (OidcUserDetails).
 * Controllers use this type so both authentication paths work uniformly.
 */
public interface LocalTubePrincipal extends UserDetails {

    String getEmail();

    /** DB user ID — null for IDP users who have no local DB record. */
    Long getUserId();

    boolean isSuperAdmin();

    boolean isAdmin();

    boolean hasPermission(String permission);

    boolean hasRole(String role);
}
