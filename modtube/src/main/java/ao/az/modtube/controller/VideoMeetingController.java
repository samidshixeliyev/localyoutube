package ao.az.modtube.controller;

import ao.az.modtube.config.security.ModTubePrincipal;
import ao.az.modtube.domain.VideoMeeting;
import ao.az.modtube.service.VideoMeetingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/meetings")
@RequiredArgsConstructor
public class VideoMeetingController {

    private final VideoMeetingService videoMeetingService;

    @Value("${modtube.webrtc.ice-servers:stun:stun.l.google.com:19302}")
    private String iceServersConfig;

    @Value("${modtube.webrtc.turn-url:}")
    private String turnUrl;

    @Value("${modtube.webrtc.turn-username:}")
    private String turnUsername;

    @Value("${modtube.webrtc.turn-credential:}")
    private String turnCredential;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getMeetings(
            @AuthenticationPrincipal ModTubePrincipal user) {
        if (user == null) return ResponseEntity.status(401).build();
        List<Map<String, Object>> result = videoMeetingService.listMeetings(user).stream()
                .map(m -> toResponse(m, user))
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createMeeting(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal ModTubePrincipal user) {
        if (user == null) return ResponseEntity.status(401).build();
        String title = body.get("title");
        if (title == null || title.isBlank()) return ResponseEntity.badRequest().build();
        VideoMeeting m = videoMeetingService.createMeeting(
                title.trim(), body.get("description"),
                body.get("visibility"), body.get("allowedEmails"), user);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(m, user));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getMeeting(
            @PathVariable Long id,
            @AuthenticationPrincipal ModTubePrincipal user) {
        if (user == null) return ResponseEntity.status(401).build();
        try {
            VideoMeeting m = videoMeetingService.getMeeting(id, user);
            return ResponseEntity.ok(toResponse(m, user));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason() != null ? e.getReason() : "Xəta"));
        }
    }

    @PostMapping("/{id}/start")
    public ResponseEntity<Map<String, Object>> startMeeting(
            @PathVariable Long id,
            @AuthenticationPrincipal ModTubePrincipal user) {
        if (user == null) return ResponseEntity.status(401).build();
        try {
            VideoMeeting m = videoMeetingService.startMeeting(id, user);
            return ResponseEntity.ok(toResponse(m, user));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason() != null ? e.getReason() : "Xəta"));
        }
    }

    @PostMapping("/{id}/end")
    public ResponseEntity<Map<String, Object>> endMeeting(
            @PathVariable Long id,
            @AuthenticationPrincipal ModTubePrincipal user) {
        if (user == null) return ResponseEntity.status(401).build();
        try {
            VideoMeeting m = videoMeetingService.endMeeting(id, user);
            return ResponseEntity.ok(toResponse(m, user));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason() != null ? e.getReason() : "Xəta"));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateMeeting(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal ModTubePrincipal user) {
        if (user == null) return ResponseEntity.status(401).build();
        try {
            VideoMeeting m = videoMeetingService.updateMeeting(
                    id, body.get("title"), body.get("description"),
                    body.get("visibility"), body.get("allowedEmails"), user);
            return ResponseEntity.ok(toResponse(m, user));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason() != null ? e.getReason() : "Xəta"));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteMeeting(
            @PathVariable Long id,
            @AuthenticationPrincipal ModTubePrincipal user) {
        if (user == null) return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        try {
            videoMeetingService.deleteMeeting(id, user);
            return ResponseEntity.ok(Map.of("status", "deleted"));
        } catch (ResponseStatusException e) {
            // Surface the reason (e.g. "Canlı görüşü silmək olmaz") so the UI can show it.
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason() != null ? e.getReason() : "Silinmə alınmadı"));
        }
    }

    @GetMapping("/ice-config")
    public ResponseEntity<Map<String, Object>> getIceConfig() {
        List<Map<String, Object>> iceServers = new ArrayList<>();
        for (String url : iceServersConfig.split(",")) {
            String trimmed = url.trim();
            if (!trimmed.isEmpty()) {
                iceServers.add(Map.of("urls", trimmed));
            }
        }
        if (!turnUrl.isBlank()) {
            Map<String, Object> turn = new HashMap<>();
            turn.put("urls", turnUrl);
            if (!turnUsername.isBlank()) turn.put("username", turnUsername);
            if (!turnCredential.isBlank()) turn.put("credential", turnCredential);
            iceServers.add(turn);
        }
        return ResponseEntity.ok(Map.of("iceServers", iceServers));
    }

    private Map<String, Object> toResponse(VideoMeeting m, ModTubePrincipal user) {
        Map<String, Object> resp = new HashMap<>();
        resp.put("id", m.getId());
        resp.put("title", m.getTitle());
        resp.put("description", m.getDescription() != null ? m.getDescription() : "");
        resp.put("status", m.getStatus());
        resp.put("visibility", m.getVisibility());
        resp.put("allowedEmails", m.getAllowedEmailList());
        resp.put("hostEmail", m.getHostEmail());
        resp.put("hostName", m.getHostName());
        boolean isHost = user != null && user.getEmail().equalsIgnoreCase(m.getHostEmail());
        boolean canManage = isHost || (user != null && user.isSuperAdmin());
        resp.put("isHost", isHost);
        resp.put("canManage", canManage);          // host OR super-admin
        resp.put("canDelete", canManage && !"LIVE".equals(m.getStatus()));
        resp.put("roomCode", m.getRoomCode());
        resp.put("createdAt", m.getCreatedAt());
        resp.put("startedAt", m.getStartedAt());
        resp.put("endedAt", m.getEndedAt());
        return resp;
    }
}
