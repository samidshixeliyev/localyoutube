package ao.az.modtube.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/project")
@Slf4j
public class ProjectController {

    private final Path projectDir;

    private static final List<String> ALLOWED_FILES = List.of(
            "docker-compose.yml", "docker-compose.yaml",
            ".env", "nginx.conf", "prometheus.yml"
    );

    public ProjectController(
            @Value("${modtube.project.dir:#{systemProperties['user.dir']}}") String dir) {
        this.projectDir = Paths.get(dir).toAbsolutePath().normalize();
        log.info("[Project] Config directory: {}", this.projectDir);
    }

    @GetMapping("/files")
    @PreAuthorize("hasAnyAuthority('super-admin', 'manage-settings')")
    public ResponseEntity<List<Map<String, Object>>> listFiles() {
        return ResponseEntity.ok(ALLOWED_FILES.stream()
                .map(name -> {
                    Path file = projectDir.resolve(name);
                    Map<String, Object> info = new LinkedHashMap<>();
                    info.put("name", name);
                    boolean exists = Files.exists(file);
                    info.put("exists", exists);
                    try {
                        info.put("size", exists ? Files.size(file) : 0L);
                        info.put("lastModified", exists ? Files.getLastModifiedTime(file).toMillis() : null);
                    } catch (IOException e) {
                        info.put("size", 0L);
                        info.put("lastModified", null);
                    }
                    return info;
                }).collect(Collectors.toList()));
    }

    @GetMapping("/file")
    @PreAuthorize("hasAnyAuthority('super-admin', 'manage-settings')")
    public ResponseEntity<Map<String, Object>> getFile(@RequestParam String name) {
        if (!ALLOWED_FILES.contains(name)) {
            return ResponseEntity.badRequest().build();
        }
        Path file = safeResolve(name);
        if (file == null) return ResponseEntity.badRequest().build();

        try {
            boolean exists = Files.exists(file);
            Map<String, Object> res = new LinkedHashMap<>();
            res.put("name", name);
            res.put("exists", exists);
            res.put("content", exists ? Files.readString(file) : "");
            res.put("size", exists ? Files.size(file) : 0L);
            res.put("lastModified", exists ? Files.getLastModifiedTime(file).toMillis() : null);
            res.put("projectDir", projectDir.toString());
            return ResponseEntity.ok(res);
        } catch (IOException e) {
            log.error("[Project] Failed to read {}: {}", name, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    @PutMapping("/file")
    @PreAuthorize("hasAnyAuthority('super-admin', 'manage-settings')")
    public ResponseEntity<Map<String, Object>> saveFile(@RequestBody Map<String, String> body) {
        String name    = body.get("name");
        String content = body.getOrDefault("content", "");
        if (!ALLOWED_FILES.contains(name)) {
            return ResponseEntity.badRequest().body(Map.of("error", "File not allowed: " + name));
        }
        Path file = safeResolve(name);
        if (file == null) return ResponseEntity.badRequest().build();

        try {
            Files.createDirectories(file.getParent());
            Files.writeString(file, content,
                    StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            log.info("[Project] Saved {} ({} bytes)", name, content.length());
            Map<String, Object> res = new LinkedHashMap<>();
            res.put("saved", true);
            res.put("name", name);
            res.put("size", Files.size(file));
            res.put("lastModified", Files.getLastModifiedTime(file).toMillis());
            return ResponseEntity.ok(res);
        } catch (IOException e) {
            log.error("[Project] Failed to write {}: {}", name, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    private Path safeResolve(String name) {
        try {
            Path resolved = projectDir.resolve(name).normalize();
            return resolved.startsWith(projectDir) ? resolved : null;
        } catch (Exception e) {
            return null;
        }
    }
}
