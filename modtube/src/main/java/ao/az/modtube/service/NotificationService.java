package ao.az.modtube.service;

import ao.az.modtube.config.security.IdpJwtValidator;
import ao.az.modtube.config.security.ModTubePrincipal;
import ao.az.modtube.config.security.ModTubeUserDetails;
import ao.az.modtube.config.security.OidcUserDetails;
import ao.az.modtube.domain.Notification;
import ao.az.modtube.repository.NotificationRepository;
import ao.az.modtube.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;
    private final IdpJwtValidator idpJwtValidator;
    private final IdpUserProvisioningService idpUserProvisioningService;

    // Active SSE connections: userEmail → set of emitters (one per open tab)
    private final ConcurrentHashMap<String, CopyOnWriteArraySet<SseEmitter>> emitters =
            new ConcurrentHashMap<>();

    // ── SSE subscription ──────────────────────────────────────────────────────

    public SseEmitter subscribe(String token) {
        ModTubePrincipal principal = authenticate(token);
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Etibarsız token");
        }

        String email = principal.getEmail();
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
        emitters.computeIfAbsent(email, k -> new CopyOnWriteArraySet<>()).add(emitter);

        Runnable cleanup = () ->
                emitters.getOrDefault(email, new CopyOnWriteArraySet<>()).remove(emitter);
        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(e -> cleanup.run());

        // Flush any existing unread notifications immediately on connect
        try {
            for (Notification n : notificationRepository
                    .findByUserEmailAndReadFalseOrderByCreatedAtDesc(email)) {
                emitter.send(SseEmitter.event().name("notification").data(toDto(n)));
            }
        } catch (IOException e) {
            log.debug("Error sending initial notifications to {}: {}", email, e.getMessage());
        }

        return emitter;
    }

    // ── Create & push ─────────────────────────────────────────────────────────

    @Transactional
    public void createAndPush(String userEmail, String type, String title,
                              String message, Long meetingId) {
        Notification n = new Notification();
        n.setUserEmail(userEmail);
        n.setType(type);
        n.setTitle(title);
        n.setMessage(message);
        n.setMeetingId(meetingId);
        n = notificationRepository.save(n);
        push(userEmail, n);
    }

    private void push(String email, Notification n) {
        Set<SseEmitter> userEmitters = emitters.get(email);
        if (userEmitters == null || userEmitters.isEmpty()) return;

        userEmitters.removeIf(emitter -> {
            try {
                emitter.send(SseEmitter.event().name("notification").data(toDto(n)));
                return false;
            } catch (IOException e) {
                emitter.completeWithError(e);
                return true;
            }
        });
    }

    // ── Heartbeat — keeps connections alive through nginx proxy ───────────────

    @Scheduled(fixedDelay = 25_000)
    public void heartbeat() {
        emitters.forEach((email, userEmitters) ->
                userEmitters.removeIf(emitter -> {
                    try {
                        emitter.send(SseEmitter.event().comment("hb"));
                        return false;
                    } catch (IOException e) {
                        emitter.completeWithError(e);
                        return true;
                    }
                })
        );
    }

    // ── DTO ───────────────────────────────────────────────────────────────────

    public Map<String, Object> toDto(Notification n) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", n.getId());
        m.put("type", n.getType());
        m.put("title", n.getTitle());
        m.put("message", n.getMessage());
        m.put("meetingId", n.getMeetingId());
        m.put("read", n.isRead());
        m.put("createdAt", n.getCreatedAt());
        return m;
    }

    // ── JWT auth (same dual-path as MeetingHandshakeInterceptor) ─────────────

    ModTubePrincipal authenticate(String jwt) {
        try {
            if (isRS256(jwt)) {
                Jwt decoded = idpJwtValidator.validate(jwt);
                if (decoded == null) return null;
                OidcUserDetails oidc = idpJwtValidator.toUserDetails(decoded);
                try {
                    var dbUser = idpUserProvisioningService.getOrCreate(oidc.getEmail(), oidc.getDisplayName());
                    return new ModTubeUserDetails(dbUser);
                } catch (Exception e) {
                    return oidc;
                }
            }
            String username = jwtUtil.extractUsername(jwt);
            if (username == null) return null;
            UserDetails ud = userDetailsService.loadUserByUsername(username);
            if (jwtUtil.validateToken(jwt, ud) && ud instanceof ModTubePrincipal p) return p;
        } catch (Exception e) {
            log.debug("SSE auth failed: {}", e.getMessage());
        }
        return null;
    }

    private boolean isRS256(String jwt) {
        try {
            String[] parts = jwt.split("\\.");
            if (parts.length < 2) return false;
            String header = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
            return header.contains("\"RS256\"") || header.contains("\"rs256\"");
        } catch (Exception e) {
            return false;
        }
    }
}
