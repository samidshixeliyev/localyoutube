package az.dev.localtube.config.security;

import az.dev.localtube.entity.User;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Custom UserDetails implementation that wraps our User entity
 */
@Getter
public class LocalTubeUserDetails implements UserDetails {

    private final User user;
    private final Collection<? extends GrantedAuthority> authorities;

    public LocalTubeUserDetails(User user) {
        this.user = user;
        this.authorities = buildAuthorities(user);
    }

    private Collection<? extends GrantedAuthority> buildAuthorities(User user) {
        if (user.getRole() == null) {
            return java.util.Collections.emptyList();
        }

        // Add role as authority (e.g., ROLE_ADMIN, ROLE_USER)
        Stream<GrantedAuthority> roleAuthority = Stream.of(
                new SimpleGrantedAuthority("ROLE_" + user.getRole().getName().toUpperCase())
        );

        // Add permissions as authorities
        Stream<GrantedAuthority> permissionAuthorities = user.getRole().getPermissions().stream()
                .map(permission -> new SimpleGrantedAuthority(permission.getName()));

        return Stream.concat(roleAuthority, permissionAuthorities)
                .collect(Collectors.toList());
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return user.getPassword();
    }

    @Override
    public String getUsername() {
        return user.getEmail();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }

    // Convenience methods
    public Long getUserId() {
        return user.getId();
    }

    public String getEmail() {
        return user.getEmail();
    }

    public boolean hasRole(String role) {
        return authorities.stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_" + role.toUpperCase()));
    }

    public boolean hasPermission(String permission) {
        return authorities.stream()
                .anyMatch(a -> a.getAuthority().equals(permission));
    }

    public boolean isAdmin() {
        return hasRole("ADMIN") || hasPermission("admin-modtube");
    }

    public boolean isSuperAdmin() {
        return hasPermission("super-admin");
    }
}