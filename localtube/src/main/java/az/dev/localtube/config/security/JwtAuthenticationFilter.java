package az.dev.localtube.config.security;

import az.dev.localtube.util.JwtUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        final String authorizationHeader = request.getHeader("Authorization");
        final String requestUri = request.getRequestURI();

        String username = null;
        String jwt = null;

        if (authorizationHeader != null && authorizationHeader.startsWith("Bearer ")) {
            jwt = authorizationHeader.substring(7);
            try {
                username = jwtUtil.extractUsername(jwt);
                log.debug("JWT extracted username: {} for request: {}", username, requestUri);
            } catch (Exception e) {
                log.warn("Failed to extract username from JWT for {}: {}", requestUri, e.getMessage());
            }
        } else {
            log.debug("No Authorization header found for request: {}", requestUri);
        }

        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                UserDetails userDetails = userDetailsService.loadUserByUsername(username);

                log.debug("Loaded UserDetails: class={}, username={}, authorities={}",
                        userDetails.getClass().getSimpleName(),
                        userDetails.getUsername(),
                        userDetails.getAuthorities());

                if (jwtUtil.validateToken(jwt, userDetails)) {
                    UsernamePasswordAuthenticationToken authenticationToken =
                            new UsernamePasswordAuthenticationToken(
                                    userDetails,
                                    null,
                                    userDetails.getAuthorities()
                            );
                    authenticationToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authenticationToken);

                    log.debug("Authentication successful for user: {} on path: {}", username, requestUri);
                } else {
                    log.warn("Token validation failed for user: {} on path: {}", username, requestUri);
                }
            } catch (Exception e) {
                log.error("Failed to authenticate user {} on path {}: {}", username, requestUri, e.getMessage());
            }
        }

        filterChain.doFilter(request, response);
    }
}