package ao.az.modtube.service;

import ao.az.modtube.config.security.ModTubePrincipal;
import ao.az.modtube.domain.Playlist;
import ao.az.modtube.domain.PlaylistItem;
import ao.az.modtube.domain.Video;
import ao.az.modtube.domain.VideoVisibility;
import ao.az.modtube.repository.PlaylistItemRepository;
import ao.az.modtube.repository.PlaylistRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PlaylistService {

    private final PlaylistRepository playlistRepository;
    private final PlaylistItemRepository playlistItemRepository;
    private final VideoService videoService;

    public List<Playlist> getUserPlaylists(String ownerEmail) {
        return playlistRepository.findByOwnerEmailOrderByCreatedAtDesc(ownerEmail);
    }

    /** All PUBLIC playlists (visible to everyone), newest first. */
    public List<Playlist> getPublicPlaylists() {
        return playlistRepository.findByVisibilityIgnoreCaseOrderByCreatedAtDesc("PUBLIC");
    }

    @Transactional
    public Playlist createPlaylist(String name, String description, String visibility,
                                   String allowedEmails, ModTubePrincipal user) {
        Playlist p = new Playlist();
        p.setName(name);
        p.setDescription(description);
        p.setVisibility(normalizeVisibility(visibility));
        p.setAllowedEmails(allowedEmails);
        p.setOwnerEmail(user.getEmail());
        p.setOwnerId(user.getUserId());
        return playlistRepository.save(p);
    }

    @Transactional
    public Playlist updatePlaylist(String playlistId, String name, String description,
                                   String visibility, String allowedEmails, ModTubePrincipal user) {
        Playlist p = getOwned(playlistId, user);
        p.setName(name);
        p.setDescription(description);
        p.setVisibility(normalizeVisibility(visibility));
        p.setAllowedEmails(allowedEmails);
        return playlistRepository.save(p);
    }

    @Transactional
    public void deletePlaylist(String playlistId, ModTubePrincipal user) {
        Playlist p = getOwned(playlistId, user);
        playlistRepository.delete(p);
    }

    @Transactional
    public PlaylistItem addVideo(String playlistId, String videoId, ModTubePrincipal user) {
        getOwned(playlistId, user);
        if (playlistItemRepository.existsByPlaylistIdAndVideoId(playlistId, videoId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Video artıq pleylistdədir");
        }
        int nextPos = playlistItemRepository.findMaxPositionByPlaylistId(playlistId)
                .map(m -> m + 1).orElse(0);
        PlaylistItem item = new PlaylistItem(playlistId, videoId, nextPos);
        return playlistItemRepository.save(item);
    }

    @Transactional
    public void removeVideo(String playlistId, String videoId, ModTubePrincipal user) {
        getOwned(playlistId, user);
        playlistItemRepository.deleteByPlaylistIdAndVideoId(playlistId, videoId);
    }

    /**
     * Returns playlist with only the videos the requesting user is allowed to see.
     * Enforces playlist-level visibility first, then per-video privacy.
     */
    public Map<String, Object> getPlaylistWithVideos(String playlistId, ModTubePrincipal viewer) {
        Playlist p = playlistRepository.findById(playlistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pleylist tapılmadı"));

        if (!canViewPlaylist(p, viewer)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bu pleylistə baxmaq icazəniz yoxdur");
        }

        List<PlaylistItem> items = playlistItemRepository.findByPlaylistIdOrderByPositionAsc(playlistId);
        List<Map<String, Object>> videoList = new ArrayList<>();

        for (PlaylistItem item : items) {
            videoService.getVideo(item.getVideoId()).ifPresent(video -> {
                if (canView(video, viewer)) {
                    Map<String, Object> vm = new HashMap<>();
                    vm.put("itemId",       item.getId());
                    vm.put("position",     item.getPosition());
                    vm.put("videoId",      video.getId());
                    vm.put("title",        video.getTitle());
                    vm.put("thumbnailUrl", video.getThumbnailUrl());
                    vm.put("duration",     video.getDurationSeconds());
                    vm.put("uploaderName", video.getUploaderName());
                    vm.put("views",        video.getViews());
                    vm.put("visibility",   video.getVisibility() != null ? video.getVisibility().name().toLowerCase() : "public");
                    videoList.add(vm);
                }
            });
        }

        Map<String, Object> result = new HashMap<>();
        result.put("id",           p.getId());
        result.put("name",         p.getName());
        result.put("description",  p.getDescription());
        result.put("ownerEmail",   p.getOwnerEmail());
        result.put("createdAt",    p.getCreatedAt());
        result.put("visibility",   p.getVisibility() != null ? p.getVisibility() : "PUBLIC");
        result.put("allowedEmails",p.getAllowedEmailList());
        result.put("videos",       videoList);
        result.put("totalItems",   items.size());
        result.put("visibleItems", videoList.size());
        return result;
    }

    /** Whether the requesting viewer is allowed to see this playlist. */
    private boolean canViewPlaylist(Playlist p, ModTubePrincipal viewer) {
        if (viewer != null && viewer.getEmail().equalsIgnoreCase(p.getOwnerEmail())) return true;
        if (viewer != null && viewer.isSuperAdmin()) return true;
        String vis = p.getVisibility() != null ? p.getVisibility().toUpperCase() : "PUBLIC";
        return switch (vis) {
            case "PUBLIC", "UNLISTED" -> true;
            case "PRIVATE" -> false;
            case "RESTRICTED" -> viewer != null && p.getAllowedEmailList().stream()
                    .anyMatch(e -> e.equalsIgnoreCase(viewer.getEmail()));
            default -> true;
        };
    }

    private String normalizeVisibility(String v) {
        if (v == null) return "PUBLIC";
        return switch (v.toUpperCase()) {
            case "PRIVATE"    -> "PRIVATE";
            case "RESTRICTED" -> "RESTRICTED";
            case "UNLISTED"   -> "UNLISTED";
            default           -> "PUBLIC";
        };
    }

    /** Whether the given viewer is allowed to see this video (privacy check). */
    private boolean canView(Video video, ModTubePrincipal viewer) {
        if (video.getVisibility() == null) return true;
        if (viewer != null && viewer.isSuperAdmin()) return true;
        return switch (video.getVisibility()) {
            case PUBLIC, UNLISTED -> true;
            case PRIVATE -> viewer != null && viewer.hasPermission("admin-modtube");
            case RESTRICTED -> {
                if (viewer == null) yield false;
                boolean isAdmin = viewer.hasPermission("admin-modtube");
                boolean allowed = video.getAllowedEmails() != null &&
                        video.getAllowedEmails().stream()
                             .anyMatch(e -> e.equalsIgnoreCase(viewer.getEmail()));
                yield isAdmin || allowed;
            }
        };
    }

    private Playlist getOwned(String playlistId, ModTubePrincipal user) {
        Playlist p = playlistRepository.findById(playlistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pleylist tapılmadı"));
        if (!p.getOwnerEmail().equalsIgnoreCase(user.getEmail()) && !user.isSuperAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bu pleylist sizin deyil");
        }
        return p;
    }
}
