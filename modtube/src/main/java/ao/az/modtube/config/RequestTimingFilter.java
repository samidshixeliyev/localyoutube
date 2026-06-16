package ao.az.modtube.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Logs slow API requests so the top offenders are visible without an APM tool.
 * Any request taking longer than {@code perf.slow-request-ms} (default 100ms) is
 * logged at WARN with method, path and duration. Health/metrics noise is skipped.
 */
@Slf4j
@Component
@Order(1)
public class RequestTimingFilter extends OncePerRequestFilter {

    @Value("${perf.slow-request-ms:100}")
    private long slowThresholdMs;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        long start = System.nanoTime();
        try {
            chain.doFilter(request, response);
        } finally {
            long ms = (System.nanoTime() - start) / 1_000_000;
            if (ms >= slowThresholdMs) {
                String uri = request.getRequestURI();
                if (!uri.startsWith("/actuator") && !uri.startsWith("/hls") && !uri.startsWith("/thumbnails")) {
                    log.warn("[SLOW {}ms] {} {} -> {}", ms, request.getMethod(), uri, response.getStatus());
                }
            }
        }
    }
}
