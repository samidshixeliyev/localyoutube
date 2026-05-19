package ao.az.modtube.controller;

import ao.az.modtube.service.SystemSettingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;

/**
 * Admin API for reading and updating dynamic system settings.
 * super-admin — full access.
 * manage-settings — same read/write access to all whitelisted keys.
 */
@RestController
@RequestMapping("/api/admin/settings")
@RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('super-admin', 'manage-settings')")
public class SystemSettingController {

    private static final Set<String> ALLOWED_KEYS = Set.of(
            "idp.base-url",
            "idp.client-id",
            "idp.redirect-uri",
            "idp.logout-redirect-uri",
            "idp.jwks-uri",
            "idp.issuer",
            "idp.enabled",
            // JWT claim name mappings
            "idp.claim.email",
            "idp.claim.fullname",
            "idp.claim.first",
            "idp.claim.last",
            "idp.claim.username",
            // Upload behaviour
            "upload.max-parallel",
            "upload.max-concurrent"
    );

    private final SystemSettingService settingService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getAll() {
        return ResponseEntity.ok(settingService.getAll());
    }

    @PutMapping
    public ResponseEntity<?> updateAll(@RequestBody Map<String, String> updates) {
        // Only allow whitelisted keys to prevent arbitrary DB writes
        updates.keySet().removeIf(k -> !ALLOWED_KEYS.contains(k));
        if (updates.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "No valid setting keys provided"));
        }
        settingService.setAll(updates);
        return ResponseEntity.ok(Map.of("updated", updates.size(), "keys", updates.keySet()));
    }
}
