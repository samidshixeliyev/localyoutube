package az.dev.localtube.controller;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@RestController
@RequestMapping("/hls")
public class HlsController {

    private static final String HLS_DIR = "hls/";

    @GetMapping("/**")
    public ResponseEntity<Resource> serveHlsFile(jakarta.servlet.http.HttpServletRequest request) {
        try {
            String requestUri = request.getRequestURI();
            String hlsPath = requestUri.substring("/hls/".length());
            hlsPath = URLDecoder.decode(hlsPath, StandardCharsets.UTF_8);

            Path filePath = Paths.get(HLS_DIR, hlsPath).toAbsolutePath().normalize();
            Path baseDir = Paths.get(HLS_DIR).toAbsolutePath().normalize();

            if (!filePath.startsWith(baseDir)) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
            }

            if (!Files.exists(filePath) || !Files.isRegularFile(filePath)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }

            String contentType = determineContentType(filePath);
            Resource resource = new FileSystemResource(filePath);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, contentType)
                    .header(HttpHeaders.CACHE_CONTROL, "no-cache, no-store, must-revalidate")
                    .body(resource);

        } catch (Exception e) {
            System.err.println("[HLS ERROR] " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    private String determineContentType(Path filePath) {
        String filename = filePath.getFileName().toString().toLowerCase();

        if (filename.endsWith(".m3u8")) {
            return "application/vnd.apple.mpegurl";
        } else if (filename.endsWith(".ts")) {
            return "video/mp2t";
        }
        return "application/octet-stream";
    }
}