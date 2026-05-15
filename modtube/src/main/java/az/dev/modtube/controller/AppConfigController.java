package az.dev.modtube.controller;

import az.dev.modtube.service.SystemSettingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Public application configuration endpoint.
 * No authentication required — these are read-only UI hints for the frontend.
 *
 * GET /api/config/upload  → { "maxParallelUploads": 2 }
 */
@RestController
@RequestMapping("/api/config")
@RequiredArgsConstructor
public class AppConfigController {

    private final SystemSettingService settingService;

    /** Returns upload-related configuration values for the frontend. */
    @GetMapping("/upload")
    public ResponseEntity<Map<String, Object>> uploadConfig() {
        int maxParallel;
        try {
            maxParallel = Integer.parseInt(settingService.get("upload.max-parallel", "2"));
            maxParallel = Math.max(1, Math.min(10, maxParallel)); // clamp 1–10
        } catch (NumberFormatException e) {
            maxParallel = 2;
        }
        return ResponseEntity.ok(Map.of("maxParallelUploads", maxParallel));
    }

    /**
     * Returns the configured Grafana base URL.
     * Empty string means "auto-detect as &lt;hostname&gt;:3000" in the frontend.
     */
    @GetMapping("/grafana")
    public ResponseEntity<Map<String, Object>> grafanaConfig() {
        String url = settingService.get("grafana.url", "");
        return ResponseEntity.ok(Map.of("grafanaUrl", url));
    }
}
