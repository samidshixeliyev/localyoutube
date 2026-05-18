package ao.az.modtube.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Proxies a metrics snapshot to Claude Opus for AI-powered analysis.
 * Requires ANTHROPIC_API_KEY env var.
 */
@Slf4j
@RestController
@RequestMapping("/api/admin/metrics")
@PreAuthorize("hasAnyAuthority('super-admin', 'view-metrics', 'ROLE_SUPER_ADMIN')")
public class MetricsAnalysisController {

    @Value("${ANTHROPIC_API_KEY:}")
    private String apiKey;

    private final ObjectMapper mapper = new ObjectMapper();

    private final RestTemplate http = buildRestTemplate();

    @PostMapping("/analyze")
    public ResponseEntity<?> analyze(@RequestBody Map<String, Object> metricsSnapshot) {
        if (apiKey == null || apiKey.isBlank()) {
            return ResponseEntity.status(503)
                    .body(Map.of("error", "ANTHROPIC_API_KEY mühit dəyişəni konfiqurasiya edilməyib"));
        }

        try {
            String metricsText = formatMetrics(metricsSnapshot);
            String analysis    = callClaude(metricsText);
            return ResponseEntity.ok(Map.of("analysis", analysis));
        } catch (Exception e) {
            log.error("[MetricsAnalysis] Claude API call failed: {}", e.getMessage());
            return ResponseEntity.status(503)
                    .body(Map.of("error", "Analiz xətası: " + e.getMessage()));
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private String formatMetrics(Map<String, Object> snap) throws Exception {
        StringBuilder sb = new StringBuilder();
        sb.append("=== ModTube Sistem Metriklər Anlıq Görünüşü ===\n\n");

        Object db = snap.get("db");
        if (db != null) {
            sb.append("--- Verilənlər Bazası ---\n");
            sb.append(mapper.writerWithDefaultPrettyPrinter().writeValueAsString(db)).append("\n\n");
        }
        Object sys = snap.get("system");
        if (sys != null) {
            sb.append("--- Sistem ---\n");
            sb.append(mapper.writerWithDefaultPrettyPrinter().writeValueAsString(sys)).append("\n\n");
        }
        Object app = snap.get("app");
        if (app != null) {
            sb.append("--- Tətbiq ---\n");
            sb.append(mapper.writerWithDefaultPrettyPrinter().writeValueAsString(app)).append("\n\n");
        }
        return sb.toString();
    }

    private String callClaude(String metricsText) throws Exception {
        String systemPrompt =
            "Siz ModTube video platformu üçün sistem metrikləri mütəxəssisisiniz. " +
            "Azərbaycan dilinde cavab verin. Qısa, praktik, aydın analiz edin. " +
            "Potensial problemləri, optimizasiya tövsiyələrini və ümumi sistemin sağlamlıq qiymətləndirilməsini qeyd edin. " +
            "Maksimum 300 söz.";

        String userMessage =
            "Aşağıdakı sistem metrik anlıq görüntüsünü analiz edin:\n\n" + metricsText;

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", "claude-opus-4-7");
        body.put("max_tokens", 1024);
        body.put("thinking", Map.of("type", "adaptive"));
        body.put("system", systemPrompt);
        body.put("messages", List.of(
            Map.of("role", "user", "content", userMessage)
        ));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", "2023-06-01");

        String requestJson = mapper.writeValueAsString(body);
        HttpEntity<String> entity = new HttpEntity<>(requestJson, headers);

        ResponseEntity<Map> response = http.exchange(
            "https://api.anthropic.com/v1/messages",
            HttpMethod.POST, entity, Map.class
        );

        if (response.getStatusCode() != HttpStatus.OK || response.getBody() == null) {
            throw new RuntimeException("Anthropic API returned " + response.getStatusCode());
        }

        // Extract the first text block from the content array
        List<Map<String, Object>> content = (List<Map<String, Object>>) response.getBody().get("content");
        if (content == null) throw new RuntimeException("No content in Anthropic response");

        for (Map<String, Object> block : content) {
            if ("text".equals(block.get("type"))) {
                return (String) block.get("text");
            }
        }
        throw new RuntimeException("No text block found in Anthropic response");
    }

    private static RestTemplate buildRestTemplate() {
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(60_000);
        return new RestTemplate(factory);
    }
}
