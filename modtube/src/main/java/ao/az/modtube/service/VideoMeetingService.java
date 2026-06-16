package ao.az.modtube.service;

import ao.az.modtube.config.security.ModTubePrincipal;
import ao.az.modtube.config.security.ModTubeUserDetails;
import ao.az.modtube.config.security.OidcUserDetails;
import ao.az.modtube.domain.VideoMeeting;
import ao.az.modtube.repository.VideoMeetingRepository;
import ao.az.modtube.util.JwtUtil;
import ao.az.modtube.websocket.MeetingSignalingHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class VideoMeetingService {

    private final VideoMeetingRepository videoMeetingRepository;
    private final MeetingSignalingHandler meetingSignalingHandler;
    private final NotificationService notificationService;
    private final JwtUtil jwtUtil;

    public List<VideoMeeting> listMeetings(ModTubePrincipal viewer) {
        return videoMeetingRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(m -> canAccessMeeting(m, viewer))
                .toList();
    }

    @Transactional
    public VideoMeeting createMeeting(String title, String description, String visibility,
                                       String allowedEmails, ModTubePrincipal user) {
        VideoMeeting m = new VideoMeeting();
        m.setTitle(title);
        m.setDescription(description);
        m.setVisibility(normalizeVisibility(visibility));
        m.setAllowedEmails(allowedEmails);
        m.setHostId(user.getUserId());
        m.setHostEmail(user.getEmail());
        m.setHostName(resolveDisplayName(user));
        m = videoMeetingRepository.save(m);

        // Notify invited users of a restricted meeting
        if ("RESTRICTED".equals(m.getVisibility())) {
            final Long meetingId = m.getId();
            final String meetingTitle = m.getTitle();
            m.getAllowedEmailList().stream()
                    .filter(e -> !e.equalsIgnoreCase(user.getEmail()))
                    .forEach(email -> notificationService.createAndPush(
                            email, "MEETING_INVITE",
                            "Görüşə dəvət",
                            "\"" + meetingTitle + "\" görüşünə dəvət olundunuz",
                            meetingId));
        }
        return m;
    }

    public VideoMeeting getMeeting(Long id, ModTubePrincipal viewer) {
        VideoMeeting m = videoMeetingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Görüş tapılmadı"));
        if (!canAccessMeeting(m, viewer)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bu görüşə qoşulmaq icazəniz yoxdur");
        }
        return m;
    }

    @Transactional
    public VideoMeeting updateMeeting(Long id, String title, String description,
                                      String visibility, String allowedEmails, ModTubePrincipal user) {
        VideoMeeting m = getOwned(id, user);
        if (title != null && !title.isBlank()) m.setTitle(title.trim());
        m.setDescription(description);
        if (visibility != null) m.setVisibility(normalizeVisibility(visibility));
        m.setAllowedEmails(allowedEmails);
        return videoMeetingRepository.save(m);
    }

    /**
     * Resolve a meeting for joining. Returns the meeting (with roomCode) only if
     * the caller is authorized: host/super-admin/moderator, a valid invite token,
     * a RESTRICTED allow-listed user, or a PUBLIC joiner with the correct PIN.
     */
    @Transactional(readOnly = true)
    public VideoMeeting joinMeeting(Long id, String pin, String inviteToken, ModTubePrincipal user) {
        VideoMeeting m = videoMeetingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Görüş tapılmadı"));

        if (canManage(m, user)) return m;
        if (inviteToken != null && !inviteToken.isBlank() && jwtUtil.isValidInviteToken(inviteToken, id)) return m;

        if (!canAccessMeeting(m, user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bu görüşə qoşulmaq icazəniz yoxdur");
        }
        String vis = m.getVisibility() != null ? m.getVisibility().toUpperCase() : "PUBLIC";
        if ("PUBLIC".equals(vis)) {
            if (pin == null || m.getJoinPin() == null || !pin.trim().equals(m.getJoinPin())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Otaq kodu yanlışdır");
            }
        }
        return m;
    }

    /** Host/moderator invites a user: grants restricted access + sends a signed join link. */
    @Transactional
    public void inviteUser(Long id, String email, ModTubePrincipal user) {
        VideoMeeting m = videoMeetingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Görüş tapılmadı"));
        if (!canManage(m, user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Dəvət göndərmək icazəniz yoxdur");
        }
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "E-poçt tələb olunur");
        }
        String target = email.trim();
        // For restricted meetings, also grant access so the WS handshake accepts them.
        if ("RESTRICTED".equalsIgnoreCase(m.getVisibility())
                && m.getAllowedEmailList().stream().noneMatch(e -> e.equalsIgnoreCase(target))) {
            String existing = m.getAllowedEmails();
            m.setAllowedEmails((existing == null || existing.isBlank()) ? target : existing + "," + target);
            videoMeetingRepository.save(m);
        }
        String token = jwtUtil.generateInviteToken(id, target);
        notificationService.createMeetingInvite(target, m.getTitle(), id, token);
    }

    /** Active connected participants for a meeting (caller must have access). */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getParticipants(Long id, ModTubePrincipal user) {
        VideoMeeting m = getMeeting(id, user);   // throws 403 if no access
        return meetingSignalingHandler.getParticipants(m.getRoomCode());
    }

    public VideoMeeting findByRoomCode(String roomCode) {
        return videoMeetingRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Görüş tapılmadı"));
    }

    @Transactional
    public VideoMeeting startMeeting(Long id, ModTubePrincipal user) {
        VideoMeeting m = getOwned(id, user);
        if (!"ENDED".equals(m.getStatus())) {
            m.setStatus("LIVE");
            if (m.getStartedAt() == null) m.setStartedAt(LocalDateTime.now());
            videoMeetingRepository.save(m);

            // Notify invited users that the meeting is now live
            if ("RESTRICTED".equals(m.getVisibility())) {
                final Long meetingId = m.getId();
                final String meetingTitle = m.getTitle();
                m.getAllowedEmailList().stream()
                        .filter(e -> !e.equalsIgnoreCase(user.getEmail()))
                        .forEach(email -> notificationService.createAndPush(
                                email, "MEETING_STARTED",
                                "Görüş başladı",
                                "\"" + meetingTitle + "\" görüşü canlıya keçdi — indi qoşulun",
                                meetingId));
            }
        }
        return m;
    }

    @Transactional
    public VideoMeeting endMeeting(Long id, ModTubePrincipal user) {
        VideoMeeting m = getOwned(id, user);
        m.setStatus("ENDED");
        m.setEndedAt(LocalDateTime.now());
        videoMeetingRepository.save(m);
        meetingSignalingHandler.endRoom(m.getRoomCode());
        return m;
    }

    @Transactional
    public void deleteMeeting(Long id, ModTubePrincipal user) {
        VideoMeeting m = getOwned(id, user);
        if ("LIVE".equals(m.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Canlı görüşü silmək olmaz");
        }
        videoMeetingRepository.delete(m);
    }

    /**
     * Access rules:
     *  - host or super-admin: always
     *  - PUBLIC: any authenticated user (joinable by link without video-call permission)
     *  - RESTRICTED: only users whose email is in allowedEmails
     */
    public boolean canAccessMeeting(VideoMeeting m, ModTubePrincipal viewer) {
        if (viewer == null) return false;
        if (viewer.isSuperAdmin()) return true;
        if (viewer.getEmail().equalsIgnoreCase(m.getHostEmail())) return true;
        String vis = m.getVisibility() != null ? m.getVisibility().toUpperCase() : "PUBLIC";
        return switch (vis) {
            case "PUBLIC" -> true;
            case "RESTRICTED" -> m.getAllowedEmailList().stream()
                    .anyMatch(e -> e.equalsIgnoreCase(viewer.getEmail()));
            default -> false;
        };
    }

    private String resolveDisplayName(ModTubePrincipal user) {
        if (user instanceof ModTubeUserDetails details) {
            String fullName = details.getUser().getFullName();
            if (fullName != null && !fullName.isBlank()) return fullName;
        }
        if (user instanceof OidcUserDetails oidc) return oidc.getDisplayName();
        return user.getEmail();
    }

    private String normalizeVisibility(String v) {
        if (v == null) return "PUBLIC";
        return switch (v.toUpperCase()) {
            case "RESTRICTED" -> "RESTRICTED";
            default -> "PUBLIC";
        };
    }

    /** Host, super-admin, or any user holding the manage-meetings permission. */
    public static boolean canManage(VideoMeeting m, ModTubePrincipal user) {
        if (user == null) return false;
        return user.getEmail().equalsIgnoreCase(m.getHostEmail())
                || user.isSuperAdmin()
                || user.hasPermission("manage-meetings");
    }

    private VideoMeeting getOwned(Long id, ModTubePrincipal user) {
        VideoMeeting m = videoMeetingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Görüş tapılmadı"));
        if (!canManage(m, user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bu görüşü idarə etmək icazəniz yoxdur");
        }
        return m;
    }
}
