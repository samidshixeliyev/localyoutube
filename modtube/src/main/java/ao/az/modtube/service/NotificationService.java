package ao.az.modtube.service;

import ao.az.modtube.config.security.IdpJwtValidator;
import ao.az.modtube.config.security.ModTubePrincipal;
import ao.az.modtube.config.security.ModTubeUserDetails;
import ao.az.modtube.config.security.OidcUserDetails;
import ao.az.modtube.domain.Notification;
import ao.az.modtube.entity.User;
import ao.az.modtube.repository.NotificationRepository;
import ao.az.modtube.repository.UserRepository;
import ao.az.modtube.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
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
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;
    private final IdpJwtValidator idpJwtValidator;
    private final IdpUserProvisioningService idpUserProvisioningService;
    private final ApplicationEventPublisher events;

    // Active SSE connections: userEmail → set of emitters (one per open tab)
    private final ConcurrentHashMap<String, CopyOnWriteArraySet<SseEmitter>> emitters =
            new ConcurrentHashMap<>();

    /** Internal event so the SSE push happens AFTER the DB transaction commits. */
    public record NotificationEvent(String email, Notification notification) {}

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
        // Push is deferred to after commit so a slow SSE client never pins this
        // request's DB connection (root cause of pool exhaustion).
        events.publishEvent(new NotificationEvent(userEmail, n));
    }

    /**
     * Broadcast an announcement/warning to every user (one notification row each).
     * Returns the number of recipients. Pushes are deferred to after-commit.
     */
    @Transactional
    public int broadcast(String title, String message, String type) {
        String t = normalizeType(type);
        java.util.List<String> emails = userRepository.findAll().stream()
                .map(User::getEmail)
                .filter(e -> e != null && !e.isBlank())
                .map(String::trim)
                .distinct()
                .toList();
        for (String email : emails) {
            Notification n = new Notification();
            n.setUserEmail(email);
            n.setType(t);
            n.setTitle(title);
            n.setMessage(message);
            n = notificationRepository.save(n);
            events.publishEvent(new NotificationEvent(email, n));
        }
        return emails.size();
    }

    private String normalizeType(String type) {
        if (type == null) return "ANNOUNCEMENT";
        return switch (type.toUpperCase()) {
            case "WARNING"   -> "WARNING";
            case "NEW_VIDEO" -> "NEW_VIDEO";
            default          -> "ANNOUNCEMENT";
        };
    }

    /** Meeting invite with a one-click join token carried in {@code data}. */
    @Transactional
    public void createMeetingInvite(String userEmail, String meetingTitle, Long meetingId, String inviteToken) {
        Notification n = new Notification();
        n.setUserEmail(userEmail);
        n.setType("MEETING_INVITE");
        n.setTitle("Görüşə dəvət");
        n.setMessage("\"" + meetingTitle + "\" görüşünə dəvət olundunuz — qoşulmaq üçün klikləyin");
        n.setMeetingId(meetingId);
        n.setData(inviteToken);
        n = notificationRepository.save(n);
        events.publishEvent(new NotificationEvent(userEmail, n));
    }

    /**
     * Delivers the SSE push only after the surrounding transaction has committed
     * (and the DB connection has been returned to the pool). If there is no
     * transaction, fallbackExecution runs it inline. This is what stops slow SSE
     * clients from holding Hikari connections.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onNotificationCommitted(NotificationEvent e) {
        push(e.email(), e.notification());
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
        m.put("data", n.getData());
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
