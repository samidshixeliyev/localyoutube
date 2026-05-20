package ao.az.modtube.controller;

import ao.az.modtube.config.security.ModTubePrincipal;
import ao.az.modtube.domain.Playlist;
import ao.az.modtube.domain.PlaylistItem;
import ao.az.modtube.repository.PlaylistItemRepository;
import ao.az.modtube.service.PlaylistService;
import ao.az.modtube.service.VideoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/playlists")
@RequiredArgsConstructor
public class PlaylistController {

    private final PlaylistService playlistService;
    private final PlaylistItemRepository playlistItemRepository;
    private final VideoService videoService;

    @GetMapping("/mine")
    public ResponseEntity<List<Map<String, Object>>> getMyPlaylists(
            @AuthenticationPrincipal ModTubePrincipal user) {
        if (user == null) return ResponseEntity.status(401).build();
        List<Playlist> playlists = playlistService.getUserPlaylists(user.getEmail());
        List<Map<String, Object>> result = playlists.stream().map(p -> {
            Map<String, Object> m = new java.util.HashMap<>();
            m.put("id",           p.getId());
            m.put("name",         p.getName());
            m.put("description",  p.getDescription() != null ? p.getDescription() : "");
            m.put("visibility",   p.getVisibility() != null ? p.getVisibility() : "PUBLIC");
            m.put("allowedEmails",p.getAllowedEmailList());
            m.put("itemCount",    playlistItemRepository.countByPlaylistId(p.getId()));
            m.put("createdAt",    p.getCreatedAt());
            String coverUrl = playlistItemRepository
                    .findFirstByPlaylistIdOrderByPositionAsc(p.getId())
                    .flatMap(item -> videoService.getVideo(item.getVideoId()))
                    .map(v -> v.getThumbnailUrl())
                    .orElse(null);
            m.put("coverUrl", coverUrl);
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createPlaylist(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal ModTubePrincipal user) {
        if (user == null) return ResponseEntity.status(401).build();
        String name = body.get("name");
        if (name == null || name.isBlank()) return ResponseEntity.badRequest().build();
        Playlist p = playlistService.createPlaylist(
                name.trim(), body.get("description"),
                body.get("visibility"), body.get("allowedEmails"), user);
        java.util.Map<String, Object> resp = new java.util.HashMap<>();
        resp.put("id",           p.getId());
        resp.put("name",         p.getName());
        resp.put("description",  p.getDescription() != null ? p.getDescription() : "");
        resp.put("visibility",   p.getVisibility() != null ? p.getVisibility() : "PUBLIC");
        resp.put("allowedEmails",p.getAllowedEmailList());
        resp.put("itemCount",    0L);
        resp.put("createdAt",    p.getCreatedAt());
        return ResponseEntity.status(HttpStatus.CREATED).body(resp);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updatePlaylist(
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal ModTubePrincipal user) {
        if (user == null) return ResponseEntity.status(401).build();
        String name = body.get("name");
        if (name == null || name.isBlank()) return ResponseEntity.badRequest().build();
        try {
            Playlist p = playlistService.updatePlaylist(
                    id, name.trim(), body.get("description"),
                    body.get("visibility"), body.get("allowedEmails"), user);
            java.util.Map<String, Object> resp = new java.util.HashMap<>();
            resp.put("id",           p.getId());
            resp.put("name",         p.getName());
            resp.put("description",  p.getDescription() != null ? p.getDescription() : "");
            resp.put("visibility",   p.getVisibility() != null ? p.getVisibility() : "PUBLIC");
            resp.put("allowedEmails",p.getAllowedEmailList());
            return ResponseEntity.ok(resp);
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePlaylist(
            @PathVariable String id,
            @AuthenticationPrincipal ModTubePrincipal user) {
        if (user == null) return ResponseEntity.status(401).build();
        try {
            playlistService.deletePlaylist(id, user);
            return ResponseEntity.noContent().build();
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).build();
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getPlaylist(
            @PathVariable String id,
            @AuthenticationPrincipal ModTubePrincipal user) {
        try {
            Map<String, Object> result = playlistService.getPlaylistWithVideos(id, user);
            return ResponseEntity.ok(result);
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).build();
        }
    }

    @PostMapping("/{id}/videos")
    public ResponseEntity<Map<String, Object>> addVideo(
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal ModTubePrincipal user) {
        if (user == null) return ResponseEntity.status(401).build();
        String videoId = body.get("videoId");
        if (videoId == null || videoId.isBlank()) return ResponseEntity.badRequest().build();
        try {
            PlaylistItem item = playlistService.addVideo(id, videoId, user);
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "itemId",   item.getId(),
                    "videoId",  item.getVideoId(),
                    "position", item.getPosition()
            ));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason() != null ? e.getReason() : "Xəta"));
        }
    }

    @DeleteMapping("/{id}/videos/{videoId}")
    public ResponseEntity<Void> removeVideo(
            @PathVariable String id,
            @PathVariable String videoId,
            @AuthenticationPrincipal ModTubePrincipal user) {
        if (user == null) return ResponseEntity.status(401).build();
        try {
            playlistService.removeVideo(id, videoId, user);
            return ResponseEntity.noContent().build();
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).build();
        }
    }
}
