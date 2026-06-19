package ao.az.modtube.controller;

import ao.az.modtube.config.security.ModTubePrincipal;
import ao.az.modtube.domain.VideoMeeting;
import ao.az.modtube.service.StorageService;
import ao.az.modtube.service.SystemSettingService;
import ao.az.modtube.service.VideoMeetingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/meetings")
@RequiredArgsConstructor
public class VideoMeetingController {

    private final VideoMeetingService videoMeetingService;
    private final SystemSettingService settingService;
    private final StorageService storage;

    /** Max chat attachment size (25 MB). Keeps a single file off-heap-friendly + quick to relay. */
    private static final long MAX_ATTACHMENT_BYTES = 25L * 1024 * 1024;

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

    @PostMapping("/{id}/join")
    public ResponseEntity<Map<String, Object>> join(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal ModTubePrincipal user) {
        if (user == null) return ResponseEntity.status(401).build();
        String pin   = body != null ? body.get("pin")   : null;
        String token = body != null ? body.get("token") : null;
        try {
            VideoMeeting m = videoMeetingService.joinMeeting(id, pin, token, user);
            Map<String, Object> resp = new HashMap<>();
            resp.put("roomCode", m.getRoomCode());
            resp.put("id", m.getId());
            resp.put("title", m.getTitle());
            resp.put("status", m.getStatus());
            return ResponseEntity.ok(resp);
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason() != null ? e.getReason() : "Qoşulmaq alınmadı"));
        }
    }

    @PostMapping("/{id}/invite")
    public ResponseEntity<Map<String, Object>> invite(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal ModTubePrincipal user) {
        if (user == null) return ResponseEntity.status(401).build();
        try {
            videoMeetingService.inviteUser(id, body.get("email"), user);
            return ResponseEntity.ok(Map.of("status", "invited"));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason() != null ? e.getReason() : "Dəvət göndərilə bilmədi"));
        }
    }

    @GetMapping("/{id}/participants")
    public ResponseEntity<?> participants(
            @PathVariable Long id,
            @AuthenticationPrincipal ModTubePrincipal user) {
        if (user == null) return ResponseEntity.status(401).build();
        try {
            return ResponseEntity.ok(videoMeetingService.getParticipants(id, user));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason() != null ? e.getReason() : "Xəta"));
        }
    }

    /**
     * Upload a chat attachment. Stored in MinIO under meeting-attachments/{roomCode}/...
     * and served back via /meeting-files/**. All such files are deleted when the meeting
     * ends (or the room empties), so attachments are temporary like the chat itself.
     */
    @PostMapping("/{id}/attachments")
    public ResponseEntity<?> uploadAttachment(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal ModTubePrincipal user) {
        if (user == null) return ResponseEntity.status(401).build();
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Fayl boşdur"));
        }
        if (file.getSize() > MAX_ATTACHMENT_BYTES) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                    .body(Map.of("error", "Fayl çox böyükdür (maksimum 25 MB)"));
        }
        try {
            // Access check: getMeeting throws 403 if the caller can't access this meeting.
            VideoMeeting m = videoMeetingService.getMeeting(id, user);
            String safeName = sanitize(file.getOriginalFilename());
            String key = "meeting-attachments/" + m.getRoomCode() + "/" + UUID.randomUUID() + "-" + safeName;
            String ct = file.getContentType() != null ? file.getContentType()
                    : StorageService.contentTypeFor(safeName);
            storage.putStream(key, file.getInputStream(), file.getSize(), ct);

            Map<String, Object> meta = new HashMap<>();
            // URL the client broadcasts in the chat message; served by MediaController.
            meta.put("url", "/meeting-files/" + m.getRoomCode() + "/" + key.substring(key.lastIndexOf('/') + 1));
            meta.put("name", file.getOriginalFilename() != null ? file.getOriginalFilename() : safeName);
            meta.put("size", file.getSize());
            meta.put("contentType", ct);
            return ResponseEntity.ok(meta);
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason() != null ? e.getReason() : "Xəta"));
        } catch (Exception e) {
            log.warn("Meeting attachment upload failed: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Fayl yüklənə bilmədi"));
        }
    }

    /** Strip path separators / unsafe chars so the object key stays well-formed. */
    private String sanitize(String name) {
        if (name == null || name.isBlank()) return "file";
        String base = name.replace('\\', '/');
        base = base.substring(base.lastIndexOf('/') + 1);
        base = base.replaceAll("[^A-Za-z0-9._-]", "_");
        return base.isBlank() ? "file" : base;
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
        boolean canManage = VideoMeetingService.canManage(m, user);
        resp.put("isHost", isHost);
        resp.put("canManage", canManage);          // host OR super-admin OR manage-meetings
        resp.put("canDelete", canManage && !"LIVE".equals(m.getStatus()));
        // roomCode (WS path) + joinPin are secrets: only managers see them directly.
        // Other users obtain roomCode via POST /join after passing the PIN/invite.
        if (canManage) {
            resp.put("roomCode", m.getRoomCode());
            resp.put("joinPin", m.getJoinPin());
        }
        resp.put("createdAt", m.getCreatedAt());
        resp.put("startedAt", m.getStartedAt());
        resp.put("endedAt", m.getEndedAt());
        return resp;
    }
}
