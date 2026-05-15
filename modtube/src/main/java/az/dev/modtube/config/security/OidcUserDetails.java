package az.dev.modtube.config.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.Collection;
import java.util.List;

/**
 * Principal for users authenticated via the AO IDP (OIDC / RS256 JWT).
 * These users have no local DB record — userId is always null.
 */
public class OidcUserDetails implements ModTubePrincipal {

    private final String email;
    private final String displayName;
    private final Collection<? extends GrantedAuthority> authorities;

    public OidcUserDetails(String email, String displayName) {
        this.email = email;
        this.displayName = displayName != null ? displayName : email;
        this.authorities = List.of(new SimpleGrantedAuthority("ROLE_USER"));
    }

    @Override public String getEmail() { return email; }
    @Override public Long getUserId() { return null; }
    @Override public boolean isSuperAdmin() { return false; }
    @Override public boolean isAdmin() { return false; }
    @Override public boolean hasPermission(String permission) { return false; }
    @Override public boolean hasRole(String role) {
        return authorities.stream().anyMatch(a -> a.getAuthority().equals("ROLE_" + role.toUpperCase()));
    }

    public String getDisplayName() { return displayName; }

    // UserDetails
    @Override public Collection<? extends GrantedAuthority> getAuthorities() { return authorities; }
    @Override public String getPassword() { return null; }
    @Override public String getUsername() { return email; }
    @Override public boolean isAccountNonExpired() { return true; }
    @Override public boolean isAccountNonLocked() { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled() { return true; }
}
