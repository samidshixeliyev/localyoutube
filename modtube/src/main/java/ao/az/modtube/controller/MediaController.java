package ao.az.modtube.controller;

import ao.az.modtube.service.StorageService;
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

    /**
     * Chat attachments for live meetings. URL /meeting-files/{roomCode}/{file} maps to
     * MinIO key meeting-attachments/{roomCode}/{file}. Served inline so images/PDFs
     * preview in the browser. These objects are deleted when the meeting ends.
     */
    @GetMapping("/meeting-files/**")
    public ResponseEntity<?> meetingFiles(HttpServletRequest request) {
        String rel = request.getRequestURI().substring("/meeting-files/".length());
        return serve("meeting-attachments/" + rel, 3600);
    }

    /** Original uploaded file download (kept in MinIO under originals/{id}/). */
    @GetMapping("/originals/**")
    public ResponseEntity<?> originals(HttpServletRequest request) {
        String key = request.getRequestURI().substring(1);
        StorageService.StoredObject obj = storage.open(key);
        if (obj == null) return ResponseEntity.notFound().build();
        String filename = key.substring(key.lastIndexOf('/') + 1);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, obj.contentType())
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentLength(obj.size())
                .cacheControl(CacheControl.noStore())
                .body(new InputStreamResource(obj.stream()));
    }

    private ResponseEntity<?> serve(String key, int cacheSeconds) {
        StorageService.StoredObject obj = storage.open(key);   // MinIO, then local-disk fallback
        if (obj == null) {
            return ResponseEntity.notFound().build();
        }
        try {
            CacheControl cache = cacheSeconds > 0
                    ? CacheControl.maxAge(cacheSeconds, TimeUnit.SECONDS).cachePublic()
                    : CacheControl.noStore();

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, obj.contentType())
                    .contentLength(obj.size())
                    .cacheControl(cache)
                    .body(new InputStreamResource(obj.stream()));
        } catch (Exception e) {
            log.warn("Failed to serve object {}: {}", key, e.getMessage());
            return ResponseEntity.status(502).build();
        }
    }
}
