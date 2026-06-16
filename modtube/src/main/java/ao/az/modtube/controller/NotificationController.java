package ao.az.modtube.controller;

import ao.az.modtube.config.security.ModTubePrincipal;
import ao.az.modtube.domain.Notification;
import ao.az.modtube.repository.NotificationRepository;
import ao.az.modtube.service.NotificationService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final NotificationRepository notificationRepository;

    /**
     * SSE stream — browsers can't set Authorization headers on EventSource,
     * so the JWT is passed as ?token=.  Auth is validated manually by
     * NotificationService (same dual-path as MeetingHandshakeInterceptor).
     * The endpoint is permitAll() in SecurityConfiguration; unauthorized
     * requests are rejected inside the service.
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@RequestParam String token, HttpServletResponse response) {
        // Disable nginx proxy buffering for SSE
        response.setHeader("X-Accel-Buffering", "no");
        response.setHeader("Cache-Control", "no-cache");
        return notificationService.subscribe(token);
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getNotifications(
            @AuthenticationPrincipal ModTubePrincipal user) {
        if (user == null) return ResponseEntity.status(401).build();
        List<Map<String, Object>> result = notificationRepository
                .findTop50ByUserEmailOrderByCreatedAtDesc(user.getEmail())
                .stream()
                .map(notificationService::toDto)
                .toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(
            @AuthenticationPrincipal ModTubePrincipal user) {
        if (user == null) return ResponseEntity.status(401).build();
        long count = notificationRepository.countByUserEmailAndReadFalse(user.getEmail());
        return ResponseEntity.ok(Map.of("count", count));
    }

    @PutMapping("/read-all")
    @Transactional
    public ResponseEntity<Void> markAllRead(@AuthenticationPrincipal ModTubePrincipal user) {
        if (user == null) return ResponseEntity.status(401).build();
        notificationRepository.markAllRead(user.getEmail());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/read")
    @Transactional
    public ResponseEntity<Void> markOneRead(@PathVariable Long id,
                                             @AuthenticationPrincipal ModTubePrincipal user) {
        if (user == null) return ResponseEntity.status(401).build();
        notificationRepository.findById(id).ifPresent(n -> {
            if (n.getUserEmail().equalsIgnoreCase(user.getEmail())) {
                n.setRead(true);
                notificationRepository.save(n);
            }
        });
        return ResponseEntity.noContent().build();
    }
}
