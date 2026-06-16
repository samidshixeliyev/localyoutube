package ao.az.modtube.controller;

import ao.az.modtube.service.StorageService;
import io.minio.StatObjectResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.InputStream;
import java.util.concurrent.TimeUnit;

/**
 * Proxies HLS playlists/segments and thumbnails from MinIO.
 *
 * Serving through the app (rather than presigned direct-to-MinIO URLs) keeps the
 * MinIO port unexposed — important on locked-down networks — and lets us enforce
 * access rules in one place later if needed. nginx forwards /hls and /thumbnails
 * here; playlists reference segments relatively so no URL rewriting is required.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class MediaController {

    private final StorageService storage;

    @GetMapping("/hls/**")
    public ResponseEntity<?> hls(HttpServletRequest request) {
        // Strip the leading slash: "/hls/{id}/master.m3u8" → key "hls/{id}/master.m3u8"
        String key = request.getRequestURI().substring(1);
        return serve(key, /*cacheSeconds*/ key.endsWith(".m3u8") ? 0 : 86400);
    }

    @GetMapping("/thumbnails/**")
    public ResponseEntity<?> thumbnails(HttpServletRequest request) {
        String key = request.getRequestURI().substring(1);
        return serve(key, 3600);
    }

    private ResponseEntity<?> serve(String key, int cacheSeconds) {
        StatObjectResponse stat = storage.stat(key);
        if (stat == null) {
            return ResponseEntity.notFound().build();
        }
        try {
            InputStream in = storage.getObject(key);
            String contentType = stat.contentType();
            if (contentType == null || contentType.isBlank() || "application/octet-stream".equals(contentType)) {
                contentType = StorageService.contentTypeFor(key);
            }

            CacheControl cache = cacheSeconds > 0
                    ? CacheControl.maxAge(cacheSeconds, TimeUnit.SECONDS).cachePublic()
                    : CacheControl.noStore();

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, contentType)
                    .contentLength(stat.size())
                    .cacheControl(cache)
                    .body(new InputStreamResource(in));
        } catch (Exception e) {
            log.warn("Failed to serve object {}: {}", key, e.getMessage());
            return ResponseEntity.status(502).build();
        }
    }
}
