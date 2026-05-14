package az.dev.localtube.controller;

import az.dev.localtube.service.SystemSettingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;

/**
 * Admin API for reading and updating dynamic system settings (OAuth2/IDP config etc.).
 * Restricted to super-admin only.
 */
@RestController
@RequestMapping("/api/admin/settings")
@RequiredArgsConstructor
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
            "upload.max-parallel"
    );

    private final SystemSettingService settingService;

    @GetMapping
    @PreAuthorize("hasAuthority('super-admin')")
    public ResponseEntity<Map<String, Object>> getAll() {
        return ResponseEntity.ok(settingService.getAll());
    }

    @PutMapping
    @PreAuthorize("hasAuthority('super-admin')")
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
