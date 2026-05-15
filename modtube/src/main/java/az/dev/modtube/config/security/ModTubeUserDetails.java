package az.dev.modtube.config.security;

import az.dev.modtube.entity.User;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.Collection;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Getter
public class ModTubeUserDetails implements ModTubePrincipal {

    private final User user;
    private final Collection<? extends GrantedAuthority> authorities;

    public ModTubeUserDetails(User user) {
        this.user = user;
        this.authorities = buildAuthorities(user);
    }

    private Collection<? extends GrantedAuthority> buildAuthorities(User user) {
        if (user.getRole() == null) {
            return java.util.Collections.emptyList();
        }
        Stream<GrantedAuthority> roleAuthority = Stream.of(
                new SimpleGrantedAuthority("ROLE_" + user.getRole().getName().toUpperCase())
        );
        Stream<GrantedAuthority> permissionAuthorities = user.getRole().getPermissions().stream()
                .map(permission -> new SimpleGrantedAuthority(permission.getName()));
        return Stream.concat(roleAuthority, permissionAuthorities).collect(Collectors.toList());
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() { return authorities; }

    @Override
    public String getPassword() { return user.getPassword(); }

    @Override
    public String getUsername() { return user.getEmail(); }

    @Override
    public boolean isAccountNonExpired() { return true; }

    @Override
    public boolean isAccountNonLocked() { return true; }

    @Override
    public boolean isCredentialsNonExpired() { return true; }

    @Override
    public boolean isEnabled() { return true; }

    // ModTubePrincipal implementation
    @Override
    public String getEmail() { return user.getEmail(); }

    @Override
    public Long getUserId() { return user.getId(); }

    @Override
    public boolean hasRole(String role) {
        return authorities.stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_" + role.toUpperCase()));
    }

    @Override
    public boolean hasPermission(String permission) {
        return authorities.stream()
                .anyMatch(a -> a.getAuthority().equals(permission));
    }

    @Override
    public boolean isAdmin() {
        return hasRole("ADMIN") || hasPermission("admin-modtube");
    }

    @Override
    public boolean isSuperAdmin() {
        return hasPermission("super-admin");
    }
}
