package ao.az.modtube.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-IP token-bucket rate limiter.
 * Global limit:      RATE_LIMIT_RPS        (default 200 req/s)
 * Chunk/init limit:  RATE_LIMIT_UPLOAD_RPS (default 20 req/s)
 *
 * Only /api/upload/chunk and /api/upload/init go through the strict upload bucket.
 * Status, cancel, config, and video-list endpoints use the global bucket only —
 * they are lightweight polling calls, not bandwidth-intensive.
 */
@Component
public class RateLimitFilter implements Filter {

    @Value("${RATE_LIMIT_RPS:200}")
    private int maxRps;

    @Value("${RATE_LIMIT_UPLOAD_RPS:20}")
    private int uploadMaxRps;

    private final Map<String, Bucket> globalBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> uploadBuckets = new ConcurrentHashMap<>();

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest  request  = (HttpServletRequest)  req;
        HttpServletResponse response = (HttpServletResponse) res;

        String ip  = clientIp(request);
        String uri = request.getRequestURI();

        // Only chunk uploads and init are bandwidth-intensive; apply strict bucket
        boolean isChunkEndpoint = uri.startsWith("/api/upload/chunk") ||
                                  uri.startsWith("/api/upload/init")  ||
                                  uri.startsWith("/api/upload/complete");

        if (isChunkEndpoint) {
            Bucket b = uploadBuckets.computeIfAbsent(ip, k -> new Bucket(uploadMaxRps));
            if (!b.tryConsume()) {
                tooMany(response, "Yükləmə limiti aşıldı — gözləyin və yenidən cəhd edin");
                return;
            }
        }

        Bucket b = globalBuckets.computeIfAbsent(ip, k -> new Bucket(maxRps));
        if (!b.tryConsume()) {
            tooMany(response, "Çox sayda sorğu — bir saniyə gözləyin");
            return;
        }

        chain.doFilter(req, res);
    }

    private void tooMany(HttpServletResponse response, String message) throws IOException {
        response.setStatus(429);
        response.setContentType("application/json;charset=UTF-8");
        response.setHeader("Retry-After", "1");
        response.getWriter().write("{\"error\":\"" + message + "\"}");
    }

    private static String clientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        String xri = request.getHeader("X-Real-IP");
        if (xri != null && !xri.isBlank()) return xri;
        return request.getRemoteAddr();
    }

    // Simple per-second token bucket — thread-safe, zero-dependency
    static final class Bucket {
        private final int max;
        private int tokens;
        private long lastRefill = System.currentTimeMillis();

        Bucket(int max) {
            this.max    = max;
            this.tokens = max;
        }

        synchronized boolean tryConsume() {
            long now = System.currentTimeMillis();
            if (now - lastRefill >= 1000L) {
                tokens     = max;
                lastRefill = now;
            }
            if (tokens > 0) { tokens--; return true; }
            return false;
        }
    }
}
