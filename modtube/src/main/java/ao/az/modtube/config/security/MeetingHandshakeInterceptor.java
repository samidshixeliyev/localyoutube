package ao.az.modtube.config.security;

import ao.az.modtube.domain.VideoMeeting;
import ao.az.modtube.service.IdpUserProvisioningService;
import ao.az.modtube.service.VideoMeetingService;
import ao.az.modtube.util.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

/**
 * Authenticates WebSocket handshakes for /ws/meetings/{roomCode}.
 * The JWT is passed as a "token" query parameter (browsers cannot set
 * Authorization headers on WS upgrades), validated via the same dual-path
 * (RS256 IDP / HS256 local) logic as {@link JwtAuthenticationFilter}, then
 * checked against the meeting's access rules.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MeetingHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;
    private final IdpJwtValidator idpJwtValidator;
    private final IdpUserProvisioningService idpUserProvisioningService;
    private final VideoMeetingService videoMeetingService;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                    WebSocketHandler wsHandler, Map<String, Object> attributes) {

        if (!(request instanceof ServletServerHttpRequest servletRequest)) {
            response.setStatusCode(HttpStatus.BAD_REQUEST);
            return false;
        }
        HttpServletRequest httpRequest = servletRequest.getServletRequest();

        String roomCode = extractRoomCode(httpRequest.getRequestURI());
        if (roomCode == null) {
            response.setStatusCode(HttpStatus.BAD_REQUEST);
            return false;
        }

        String token = httpRequest.getParameter("token");
        if (token == null || token.isBlank()) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }

        ModTubePrincipal principal = authenticate(token);
        if (principal == null) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }

        VideoMeeting meeting;
        try {
            meeting = videoMeetingService.findByRoomCode(roomCode);
        } catch (Exception e) {
            response.setStatusCode(HttpStatus.NOT_FOUND);
            return false;
        }

        // canAccessMeeting handles PUBLIC (any authenticated user) and RESTRICTED (allowedEmails)
        if (!videoMeetingService.canAccessMeeting(meeting, principal)) {
            response.setStatusCode(HttpStatus.FORBIDDEN);
            return false;
        }

        attributes.put("email", principal.getEmail());
        attributes.put("name", resolveDisplayName(principal));
        attributes.put("meetingId", meeting.getId());
        attributes.put("roomCode", roomCode);
        attributes.put("isHost", principal.getEmail().equalsIgnoreCase(meeting.getHostEmail()));
        // Moderators (super-admin / manage-meetings) get the same in-room controls as the host.
        attributes.put("canManage", VideoMeetingService.canManage(meeting, principal));
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                WebSocketHandler wsHandler, Exception exception) {
        // no-op
    }

    private String extractRoomCode(String path) {
        int idx = path.lastIndexOf('/');
        if (idx < 0 || idx == path.length() - 1) return null;
        return path.substring(idx + 1);
    }

    private ModTubePrincipal authenticate(String jwt) {
        try {
            if (isRS256(jwt)) {
                Jwt decoded = idpJwtValidator.validate(jwt);
                if (decoded == null) return null;
                OidcUserDetails oidc = idpJwtValidator.toUserDetails(decoded);
                try {
                    var dbUser = idpUserProvisioningService.getOrCreate(oidc.getEmail(), oidc.getDisplayName(), oidc.getSubject());
                    return new ModTubeUserDetails(dbUser);
                } catch (Exception e) {
                    return oidc;
                }
            }

            String username = jwtUtil.extractUsername(jwt);
            if (username == null) return null;
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
            if (jwtUtil.validateToken(jwt, userDetails) && userDetails instanceof ModTubePrincipal principal) {
                return principal;
            }
            return null;
        } catch (Exception e) {
            log.debug("WS handshake authentication failed: {}", e.getMessage());
            return null;
        }
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

    private String resolveDisplayName(ModTubePrincipal principal) {
        if (principal instanceof ModTubeUserDetails details) {
            String fullName = details.getUser().getFullName();
            if (fullName != null && !fullName.isBlank()) return fullName;
        }
        if (principal instanceof OidcUserDetails oidc) {
            return oidc.getDisplayName();
        }
        return principal.getEmail();
    }
}
