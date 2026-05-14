package az.dev.localtube.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Proxies Prometheus queries to the frontend.
 *
 * Prometheus runs on localhost:9090 inside the container and is NOT exposed
 * externally, so the frontend cannot call it directly. This controller acts
 * as a thin, authenticated proxy — only super-admins may call these endpoints.
 *
 * Two endpoints:
 *   GET /api/admin/metrics/instant?query=...
 *       → Prometheus /api/v1/query  (current value)
 *
 *   GET /api/admin/metrics/range?query=...&start=...&end=...&step=...
 *       → Prometheus /api/v1/query_range  (time series)
 */
@Slf4j
@RestController
@RequestMapping("/api/admin/metrics")
@PreAuthorize("hasAnyAuthority('super-admin', 'view-metrics')")
public class MetricsProxyController {

    private static final String PROM = "http://localhost:9090";
    private final RestTemplate http = new RestTemplate();

    /** Current (instant) value for one PromQL expression. */
    @GetMapping("/instant")
    public ResponseEntity<String> instant(@RequestParam String query) {
        String url = PROM + "/api/v1/query?query=" + enc(query);
        return proxy(url);
    }

    /** Time-series data for one PromQL expression. */
    @GetMapping("/range")
    public ResponseEntity<String> range(
            @RequestParam String query,
            @RequestParam String start,
            @RequestParam String end,
            @RequestParam(defaultValue = "60") String step) {
        String url = PROM + "/api/v1/query_range"
                + "?query=" + enc(query)
                + "&start=" + enc(start)
                + "&end=" + enc(end)
                + "&step=" + enc(step);
        return proxy(url);
    }

    private ResponseEntity<String> proxy(String url) {
        try {
            String body = http.getForObject(url, String.class);
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body);
        } catch (Exception e) {
            log.warn("[MetricsProxy] Prometheus unreachable: {}", e.getMessage());
            return ResponseEntity.status(503)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("{\"status\":\"error\",\"error\":\"Prometheus unavailable\"}");
        }
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
