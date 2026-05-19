package ao.az.modtube.controller;

import ao.az.modtube.config.security.ModTubeUserDetails;
import ao.az.modtube.dto.request.AdminResetPasswordRequest;
import ao.az.modtube.dto.request.CreateRoleRequest;
import ao.az.modtube.dto.request.CreateUserRequest;
import ao.az.modtube.dto.request.UpdateRoleRequest;
import ao.az.modtube.dto.request.UpdateUserRequest;
import ao.az.modtube.dto.response.PermissionResponse;
import ao.az.modtube.dto.response.RoleResponse;
import ao.az.modtube.dto.response.UserResponse;
import ao.az.modtube.domain.VideoStatus;
import ao.az.modtube.repository.VideoViewRepository;
import ao.az.modtube.service.AdminService;
import ao.az.modtube.service.VideoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;
    private final VideoService videoService;
    private final VideoViewRepository videoViewRepository;

    // ═══════════════════════════════════════════════════════════════
    // STATS
    // ═══════════════════════════════════════════════════════════════

    @GetMapping("/stats")
    @PreAuthorize("hasAnyAuthority('super-admin', 'view-metrics')")
    public ResponseEntity<Map<String, Object>> getStats() {
        try {
            return ResponseEntity.ok(Map.of(
                "totalVideos",        videoService.countAllReadyVideos(),
                "totalViews",         videoService.getTotalViews(),
                "totalFileSizeBytes", videoService.getTotalFileSizeBytes(),
                "activeTranscodings", videoService.countByStatus(VideoStatus.PROCESSING)
            ));
        } catch (Exception e) {
            log.error("Error fetching admin stats", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // USER ENDPOINTS
    // ═══════════════════════════════════════════════════════════════

    @GetMapping("/users")
    @PreAuthorize("hasAnyAuthority('super-admin', 'manage-users')")
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        return ResponseEntity.ok(adminService.getAllUsers());
    }

    @GetMapping("/users/search")
    @PreAuthorize("hasAnyAuthority('super-admin', 'manage-users')")
    public ResponseEntity<Map<String, Object>> searchUsers(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(required = false) Long roleId,
            @RequestParam(defaultValue = "") String permission,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(adminService.searchUsers(search, roleId, permission, page, size));
    }

    @GetMapping("/users/{id}")
    @PreAuthorize("hasAnyAuthority('super-admin', 'manage-users')")
    public ResponseEntity<UserResponse> getUser(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.getUserById(id));
    }

    @PostMapping("/users")
    @PreAuthorize("hasAnyAuthority('super-admin', 'manage-users')")
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserResponse created = adminService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/users/{id}")
    @PreAuthorize("hasAnyAuthority('super-admin', 'manage-users')")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(adminService.updateUser(id, request));
    }

    @DeleteMapping("/users/{id}")
    @PreAuthorize("hasAnyAuthority('super-admin', 'manage-users')")
    public ResponseEntity<Map<String, String>> deleteUser(
            @PathVariable Long id,
            @AuthenticationPrincipal ModTubeUserDetails currentUser) {
        adminService.deleteUser(id, currentUser.getUserId());
        return ResponseEntity.ok(Map.of("message", "User deleted successfully"));
    }

    @PostMapping("/users/{id}/password")
    @PreAuthorize("hasAnyAuthority('super-admin', 'manage-users')")
    public ResponseEntity<Map<String, String>> resetUserPassword(
            @PathVariable Long id,
            @Valid @RequestBody AdminResetPasswordRequest request) {
        adminService.resetUserPassword(id, request.getNewPassword());
        return ResponseEntity.ok(Map.of("message", "Password reset successfully"));
    }

    // ═══════════════════════════════════════════════════════════════
    // ROLE ENDPOINTS
    // ═══════════════════════════════════════════════════════════════

    @GetMapping("/roles")
    @PreAuthorize("hasAnyAuthority('super-admin', 'manage-roles')")
    public ResponseEntity<List<RoleResponse>> getAllRoles() {
        return ResponseEntity.ok(adminService.getAllRoles());
    }

    @GetMapping("/roles/{id}")
    @PreAuthorize("hasAnyAuthority('super-admin', 'manage-roles')")
    public ResponseEntity<RoleResponse> getRole(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.getRoleById(id));
    }

    @GetMapping("/permissions")
    @PreAuthorize("hasAnyAuthority('super-admin', 'manage-roles')")
    public ResponseEntity<List<PermissionResponse>> getAllPermissions() {
        return ResponseEntity.ok(adminService.getAllPermissions());
    }

    @PostMapping("/permissions")
    @PreAuthorize("hasAnyAuthority('super-admin', 'manage-roles')")
    public ResponseEntity<PermissionResponse> createPermission(
            @RequestBody Map<String, String> body) {
        String name = body.get("name");
        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        PermissionResponse created = adminService.createPermission(
                name, body.get("description"), body.get("type"));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @DeleteMapping("/permissions/{id}")
    @PreAuthorize("hasAnyAuthority('super-admin', 'manage-roles')")
    public ResponseEntity<Map<String, String>> deletePermission(@PathVariable Long id) {
        adminService.deletePermission(id);
        return ResponseEntity.ok(Map.of("message", "Permission deleted successfully"));
    }

    @PostMapping("/roles")
    @PreAuthorize("hasAnyAuthority('super-admin', 'manage-roles')")
    public ResponseEntity<RoleResponse> createRole(@Valid @RequestBody CreateRoleRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(adminService.createRole(request));
    }

    @PutMapping("/roles/{id}")
    @PreAuthorize("hasAnyAuthority('super-admin', 'manage-roles')")
    public ResponseEntity<RoleResponse> updateRole(
            @PathVariable Long id,
            @Valid @RequestBody UpdateRoleRequest request) {
        return ResponseEntity.ok(adminService.updateRole(id, request));
    }

    @DeleteMapping("/roles/{id}")
    @PreAuthorize("hasAnyAuthority('super-admin', 'manage-roles')")
    public ResponseEntity<Map<String, String>> deleteRole(@PathVariable Long id) {
        adminService.deleteRole(id);
        return ResponseEntity.ok(Map.of("message", "Role deleted successfully"));
    }

    // ═══════════════════════════════════════════════════════════════
    // VIEW ANALYTICS
    // ═══════════════════════════════════════════════════════════════

    @GetMapping("/analytics/top-videos")
    @PreAuthorize("hasAnyAuthority('super-admin', 'view-metrics')")
    public ResponseEntity<List<Map<String, Object>>> topVideos(
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "20") int limit) {
        Instant since = Instant.now().minus(days, ChronoUnit.DAYS);
        return ResponseEntity.ok(videoViewRepository.findTopVideos(since, limit).stream()
            .map(r -> {
                Map<String, Object> m = new HashMap<>();
                m.put("videoId",      r[0]);
                m.put("title",        r[1]);
                m.put("uploaderName", r[2]);
                m.put("viewCount",    ((Number) r[3]).longValue());
                m.put("lastViewed",   r[4] != null ? r[4].toString() : null);
                return m;
            }).collect(Collectors.toList()));
    }

    @GetMapping("/analytics/top-users")
    @PreAuthorize("hasAnyAuthority('super-admin', 'view-metrics')")
    public ResponseEntity<List<Map<String, Object>>> topUsers(
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "20") int limit) {
        Instant since = Instant.now().minus(days, ChronoUnit.DAYS);
        return ResponseEntity.ok(videoViewRepository.findTopUsers(since, limit).stream()
            .map(r -> {
                Map<String, Object> m = new HashMap<>();
                m.put("userEmail",    r[0]);
                m.put("userId",       r[1]);
                m.put("viewCount",    ((Number) r[2]).longValue());
                m.put("uniqueVideos", ((Number) r[3]).longValue());
                m.put("lastViewed",   r[4] != null ? r[4].toString() : null);
                return m;
            }).collect(Collectors.toList()));
    }

    @GetMapping("/analytics/daily-views")
    @PreAuthorize("hasAnyAuthority('super-admin', 'view-metrics')")
    public ResponseEntity<List<Map<String, Object>>> dailyViews(
            @RequestParam(defaultValue = "30") int days) {
        Instant since = Instant.now().minus(days, ChronoUnit.DAYS);
        return ResponseEntity.ok(videoViewRepository.findDailyViews(since).stream()
            .map(r -> {
                Map<String, Object> m = new HashMap<>();
                m.put("day",       r[0].toString());
                m.put("viewCount", ((Number) r[1]).longValue());
                return m;
            }).collect(Collectors.toList()));
    }

    @GetMapping("/analytics/hourly")
    @PreAuthorize("hasAnyAuthority('super-admin', 'view-metrics')")
    public ResponseEntity<List<Map<String, Object>>> hourlyDistribution(
            @RequestParam(defaultValue = "30") int days) {
        Instant since = Instant.now().minus(days, ChronoUnit.DAYS);
        return ResponseEntity.ok(videoViewRepository.findHourlyDistribution(since).stream()
            .map(r -> {
                Map<String, Object> m = new HashMap<>();
                m.put("hour",      ((Number) r[0]).intValue());
                m.put("viewCount", ((Number) r[1]).longValue());
                return m;
            }).collect(Collectors.toList()));
    }

    @GetMapping("/analytics/summary")
    @PreAuthorize("hasAnyAuthority('super-admin', 'view-metrics')")
    public ResponseEntity<Map<String, Object>> analyticsSummary(
            @RequestParam(defaultValue = "30") int days) {
        Instant since30 = Instant.now().minus(30, ChronoUnit.DAYS);
        Instant since7  = Instant.now().minus(7,  ChronoUnit.DAYS);
        Instant since1  = Instant.now().minus(1,  ChronoUnit.DAYS);
        Map<String, Object> m = new HashMap<>();
        m.put("views30d",       videoViewRepository.countSince(since30));
        m.put("views7d",        videoViewRepository.countSince(since7));
        m.put("views24h",       videoViewRepository.countSince(since1));
        m.put("activeUsers30d", videoViewRepository.countActiveUsers(since30));
        m.put("activeUsers7d",  videoViewRepository.countActiveUsers(since7));
        m.put("watchedVideos",  videoViewRepository.countWatchedVideos(since30));
        return ResponseEntity.ok(m);
    }
}