package ao.az.modtube.service;

import io.minio.*;
import io.minio.errors.ErrorResponseException;
import io.minio.messages.DeleteObject;
import io.minio.messages.Item;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

/**
 * S3-compatible object storage (MinIO) wrapper.
 *
 * Object key layout:
 *   hls/{videoId}/master.m3u8
 *   hls/{videoId}/{quality}/playlist.m3u8
 *   hls/{videoId}/{quality}/seg_00001.ts
 *   thumbnails/{videoId}/default.jpg
 *   thumbnails/{videoId}/custom.jpg
 *
 * HLS playlists use relative segment references, so no URL rewriting is needed —
 * the browser resolves them against the request path, which keeps hitting the
 * media proxy controller.
 */
@Slf4j
@Service
public class StorageService {

    private final MinioClient client;
    private final String bucket;

    public StorageService(
            @Value("${modtube.storage.minio.endpoint}")   String endpoint,
            @Value("${modtube.storage.minio.access-key}") String accessKey,
            @Value("${modtube.storage.minio.secret-key}") String secretKey,
            @Value("${modtube.storage.minio.bucket}")     String bucket) {
        this.bucket = bucket;
        this.client = MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey)
                .build();
        log.info("StorageService configured: endpoint={} bucket={}", endpoint, bucket);
    }

    @PostConstruct
    public void ensureBucket() {
        // MinIO may still be booting when the app starts (compose ordering only
        // guarantees container start, not readiness). Retry for ~45s before giving up.
        for (int attempt = 1; attempt <= 15; attempt++) {
            try {
                boolean exists = client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
                if (!exists) {
                    client.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
                    log.info("Created MinIO bucket: {}", bucket);
                } else {
                    log.info("MinIO bucket '{}' ready", bucket);
                }
                return;
            } catch (Exception e) {
                log.warn("MinIO not ready (attempt {}/15): {}", attempt, e.getMessage());
                try { Thread.sleep(3000); } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return;
                }
            }
        }
        log.error("MinIO bucket '{}' could not be verified after retries — uploads will fail until MinIO is reachable", bucket);
    }

    /** Uploads a single file under the given object key. */
    public void putObject(String key, Path file, String contentType) throws Exception {
        try (InputStream in = Files.newInputStream(file)) {
            client.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(key)
                    .stream(in, Files.size(file), -1)
                    .contentType(contentType != null ? contentType : "application/octet-stream")
                    .build());
        }
    }

    /** Uploads a stream of known length. */
    public void putStream(String key, InputStream in, long size, String contentType) throws Exception {
        client.putObject(PutObjectArgs.builder()
                .bucket(bucket)
                .object(key)
                .stream(in, size, -1)
                .contentType(contentType != null ? contentType : "application/octet-stream")
                .build());
    }

    /**
     * Recursively uploads every file under {@code localDir} to {@code keyPrefix},
     * preserving the relative directory structure (forward-slash keys).
     */
    public void uploadDirectory(Path localDir, String keyPrefix) throws Exception {
        if (!Files.isDirectory(localDir)) return;
        try (Stream<Path> walk = Files.walk(localDir)) {
            List<Path> files = walk.filter(Files::isRegularFile).toList();
            for (Path f : files) {
                String rel = localDir.relativize(f).toString().replace('\\', '/');
                String key = keyPrefix.endsWith("/") ? keyPrefix + rel : keyPrefix + "/" + rel;
                putObject(key, f, contentTypeFor(rel));
            }
        }
    }

    /** Returns an object's content stream, or null if it doesn't exist. */
    public StatObjectResponse stat(String key) {
        try {
            return client.statObject(StatObjectArgs.builder().bucket(bucket).object(key).build());
        } catch (ErrorResponseException e) {
            return null;
        } catch (Exception e) {
            log.debug("stat failed for {}: {}", key, e.getMessage());
            return null;
        }
    }

    public InputStream getObject(String key) throws Exception {
        return client.getObject(GetObjectArgs.builder().bucket(bucket).object(key).build());
    }

    /** Deletes every object under the given key prefix (e.g. "hls/{videoId}"). */
    public void deletePrefix(String prefix) {
        try {
            String normalized = prefix.endsWith("/") ? prefix : prefix + "/";
            List<DeleteObject> toDelete = new ArrayList<>();
            Iterable<Result<Item>> objects = client.listObjects(ListObjectsArgs.builder()
                    .bucket(bucket).prefix(normalized).recursive(true).build());
            for (Result<Item> r : objects) {
                toDelete.add(new DeleteObject(r.get().objectName()));
            }
            if (toDelete.isEmpty()) return;
            Iterable<Result<io.minio.messages.DeleteError>> errors = client.removeObjects(
                    RemoveObjectsArgs.builder().bucket(bucket).objects(toDelete).build());
            for (Result<io.minio.messages.DeleteError> e : errors) {
                log.warn("Failed to delete object: {}", e.get().objectName());
            }
            log.info("Deleted {} objects under prefix {}", toDelete.size(), normalized);
        } catch (Exception e) {
            log.warn("deletePrefix failed for {}: {}", prefix, e.getMessage());
        }
    }

    /** Maps a file name to an HTTP content type for HLS/thumbnail serving. */
    public static String contentTypeFor(String name) {
        String lower = name.toLowerCase();
        if (lower.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
        if (lower.endsWith(".ts"))   return "video/mp2t";
        if (lower.endsWith(".m4s"))  return "video/iso.segment";
        if (lower.endsWith(".mp4"))  return "video/mp4";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".png"))  return "image/png";
        if (lower.endsWith(".webp")) return "image/webp";
        return "application/octet-stream";
    }
}
