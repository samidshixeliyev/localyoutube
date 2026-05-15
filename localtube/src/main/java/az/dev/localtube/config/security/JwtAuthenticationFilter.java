package az.dev.localtube.config.security;

import az.dev.localtube.service.IdpUserProvisioningService;
import az.dev.localtube.util.JwtUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;
    private final IdpJwtValidator idpJwtValidator;
    private final IdpUserProvisioningService idpUserProvisioningService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        final String authorizationHeader = request.getHeader("Authorization");
        final String requestUri = request.getRequestURI();

        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            log.debug("No Bearer token for: {}", requestUri);
            filterChain.doFilter(request, response);
            return;
        }

        String jwt = authorizationHeader.substring(7);

        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            if (isRS256(jwt)) {
                authenticateWithIdp(jwt, request, requestUri);
            } else {
                authenticateWithLocalJwt(jwt, request, requestUri);
            }
        } catch (Exception e) {
            log.warn("Authentication failed for {}: {}", requestUri, e.getMessage());
        }

        filterChain.doFilter(request, response);
    }

    private boolean isRS256(String jwt) {
        try {
            String[] parts = jwt.split("\\.");
            if (parts.length < 2) return false;
            String headerJson = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
            return headerJson.contains("\"RS256\"") || headerJson.contains("\"rs256\"");
        } catch (Exception e) {
            return false;
        }
    }

    private void authenticateWithIdp(String jwt, HttpServletRequest request, String requestUri) {
        Jwt decoded = idpJwtValidator.validate(jwt);
        if (decoded == null) {
            log.warn("IDP JWT validation failed for: {}", requestUri);
            return;
        }

        OidcUserDetails oidc = idpJwtValidator.toUserDetails(decoded);

        // Auto-provision IDP user in the local DB so admins can see and manage them.
        // On success we use ModTubeUserDetails so admin-assigned roles/permissions apply.
        try {
            var dbUser = idpUserProvisioningService.getOrCreate(oidc.getEmail(), oidc.getDisplayName());
            var userDetails = new ModTubeUserDetails(dbUser);
            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                    userDetails, null, userDetails.getAuthorities());
            auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(auth);
            log.debug("IDP auth successful: {} on {}", oidc.getEmail(), requestUri);
        } catch (Exception e) {
            // DB unavailable or role missing — fall back to OIDC-only (no DB record)
            log.warn("IDP user provisioning failed for {}: {} — using OIDC-only auth", oidc.getEmail(), e.getMessage());
            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                    oidc, null, oidc.getAuthorities());
            auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
    }

    private void authenticateWithLocalJwt(String jwt, HttpServletRequest request, String requestUri) {
        String username;
        try {
            username = jwtUtil.extractUsername(jwt);
        } catch (Exception e) {
            log.warn("Failed to extract username from local JWT for {}: {}", requestUri, e.getMessage());
            return;
        }

        if (username == null) return;

        try {
            var userDetails = userDetailsService.loadUserByUsername(username);
            if (jwtUtil.validateToken(jwt, userDetails)) {
                UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(auth);
                log.debug("Local auth successful: {} on {}", username, requestUri);
            } else {
                log.warn("Local JWT validation failed for: {} on {}", username, requestUri);
            }
        } catch (Exception e) {
            log.error("Failed to authenticate local user {} on {}: {}", username, requestUri, e.getMessage());
        }
    }
}
