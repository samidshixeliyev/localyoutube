package ao.az.modtube.service;

import io.minio.*;
import io.minio.errors.ErrorResponseException;
import io.minio.messages.DeleteObject;
import io.minio.messages.Item;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import okhttp3.OkHttpClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509TrustManager;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
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
    private final String endpoint;
    /** Whether MinIO is reachable (set at startup; retried on use). */
    private volatile boolean minioReady = false;

    public StorageService(
            @Value("${modtube.storage.minio.endpoint}")   String endpoint,
            @Value("${modtube.storage.minio.access-key}") String accessKey,
            @Value("${modtube.storage.minio.secret-key}") String secretKey,
            @Value("${modtube.storage.minio.bucket}")     String bucket,
            @Value("${modtube.storage.minio.region:}")    String region,
            @Value("${modtube.storage.minio.ca-cert:}")   String caCertPath,
            @Value("${modtube.storage.minio.insecure:false}") boolean insecure) {
        this.bucket = bucket;
        this.endpoint = endpoint;
        MinioClient.Builder builder = MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey);
        if (region != null && !region.isBlank()) {
            builder.region(region.trim());
        }
        // HTTPS MinIO with a custom/self-signed cert: build an HTTP client that trusts
        // the supplied CA/server PEM (MINIO_CA_CERT), or skip verification entirely
        // (MINIO_INSECURE=true). Without this an https:// MinIO fails the TLS handshake.
        String tls = "default trust store";
        try {
            OkHttpClient http = buildHttpClient(caCertPath, insecure);
            if (http != null) {
                builder.httpClient(http);
                tls = insecure ? "INSECURE (no verification)" : "custom CA: " + caCertPath;
            }
        } catch (Exception e) {
            log.error("Failed to configure MinIO TLS trust ({}): {}",
                    insecure ? "insecure" : caCertPath, e.getMessage());
        }
        this.client = builder.build();
        log.info("StorageService configured: endpoint={} bucket={} region={} tls={}",
                endpoint, bucket, region == null || region.isBlank() ? "(default)" : region, tls);
    }

    /**
     * Builds an OkHttpClient that trusts a custom CA/server cert PEM (for HTTPS MinIO),
     * or trusts everything when {@code insecure}. Returns null to use defaults.
     */
    private OkHttpClient buildHttpClient(String caCertPath, boolean insecure) throws Exception {
        if (insecure) {
            X509TrustManager trustAll = new X509TrustManager() {
                public void checkClientTrusted(X509Certificate[] c, String a) {}
                public void checkServerTrusted(X509Certificate[] c, String a) {}
                public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
            };
            SSLContext ctx = SSLContext.getInstance("TLS");
            ctx.init(null, new TrustManager[]{trustAll}, new SecureRandom());
            return new OkHttpClient.Builder()
                    .sslSocketFactory(ctx.getSocketFactory(), trustAll)
                    .hostnameVerifier((h, s) -> true)
                    .build();
        }
        if (caCertPath == null || caCertPath.isBlank()) return null;   // use JVM default trust store
        if (!Files.isReadable(Paths.get(caCertPath))) {
            throw new IllegalArgumentException("MINIO_CA_CERT not readable: " + caCertPath);
        }
        CertificateFactory cf = CertificateFactory.getInstance("X.509");
        KeyStore ks = KeyStore.getInstance(KeyStore.getDefaultType());
        ks.load(null, null);
        try (InputStream in = Files.newInputStream(Paths.get(caCertPath))) {
            int i = 0;
            for (Certificate cert : cf.generateCertificates(in)) {
                ks.setCertificateEntry("minio-ca-" + (i++), cert);
            }
        }
        TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        tmf.init(ks);
        X509TrustManager tm = (X509TrustManager) tmf.getTrustManagers()[0];
        SSLContext ctx = SSLContext.getInstance("TLS");
        ctx.init(null, new TrustManager[]{tm}, new SecureRandom());
        return new OkHttpClient.Builder()
                .sslSocketFactory(ctx.getSocketFactory(), tm)
                .build();
    }

    public boolean isMinioReady() { return minioReady; }

    @PostConstruct
    public void ensureBucket() {
        // MinIO may still be booting when the app starts. Retry briefly.
        for (int attempt = 1; attempt <= 10; attempt++) {
            try {
                boolean exists = client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
                if (!exists) {
                    client.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
                    log.info("Created MinIO bucket: {}", bucket);
                } else {
                    log.info("MinIO bucket '{}' ready", bucket);
                }
                minioReady = true;
                return;
            } catch (Exception e) {
                log.warn("MinIO not ready (attempt {}/10) at {}: {}", attempt, endpoint, e.getMessage());
                try { Thread.sleep(3000); } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return;
                }
            }
        }
        minioReady = false;
        log.error("MinIO unreachable at {} — uploads will FAIL until MinIO is reachable. "
                + "Ensure the app and MinIO share a Docker network and MINIO_ENDPOINT is correct.", endpoint);
    }

    /** A stored object's stream + metadata from MinIO. */
    public record StoredObject(InputStream stream, long size, String contentType) {}

    private void requireMinio() {
        if (!minioReady && !pingMinio()) {
            throw new IllegalStateException("MinIO storage unreachable at " + endpoint
                    + " — app and MinIO must share a Docker network; check MINIO_ENDPOINT.");
        }
    }

    /** Re-check MinIO availability (it may have come up after app start). */
    private boolean pingMinio() {
        try {
            client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
            minioReady = true;
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** Uploads a single file to MinIO (retries transient failures). Never writes to disk. */
    public void putObject(String key, Path file, String contentType) throws Exception {
        requireMinio();
        String ct = contentType != null ? contentType : "application/octet-stream";
        Exception last = null;
        for (int attempt = 1; attempt <= 3; attempt++) {
            try (InputStream in = Files.newInputStream(file)) {
                client.putObject(PutObjectArgs.builder()
                        .bucket(bucket).object(key)
                        .stream(in, Files.size(file), -1)
                        .contentType(ct).build());
                return;
            } catch (Exception e) {
                last = e;
                log.warn("MinIO put failed for {} (attempt {}/3): {}", key, attempt, e.getMessage());
                try { Thread.sleep(500L * attempt); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }
            }
        }
        throw new IllegalStateException("MinIO upload failed for " + key + " at " + endpoint
                + ": " + (last != null ? last.getMessage() : "unknown"), last);
    }

    /** Uploads a stream of known length to MinIO. Never writes to disk. */
    public void putStream(String key, InputStream in, long size, String contentType) throws Exception {
        requireMinio();
        String ct = contentType != null ? contentType : "application/octet-stream";
        client.putObject(PutObjectArgs.builder()
                .bucket(bucket).object(key)
                .stream(in, size, -1).contentType(ct).build());
    }

    /**
     * Recursively uploads every file under {@code localDir} to {@code keyPrefix},
     * preserving the relative directory structure (forward-slash keys).
     */
    public void uploadDirectory(Path localDir, String keyPrefix) throws Exception {
        if (!Files.isDirectory(localDir)) return;
        requireMinio();
        int count = 0;
        try (Stream<Path> walk = Files.walk(localDir)) {
            List<Path> files = walk.filter(Files::isRegularFile).toList();
            for (Path f : files) {
                String rel = localDir.relativize(f).toString().replace('\\', '/');
                String key = keyPrefix.endsWith("/") ? keyPrefix + rel : keyPrefix + "/" + rel;
                putObject(key, f, contentTypeFor(rel));
                count++;
            }
        }
        log.info("Uploaded {} files to MinIO under {}", count, keyPrefix);
    }

    /** Opens an object for reading from MinIO. Returns null if it doesn't exist. */
    public StoredObject open(String key) {
        try {
            StatObjectResponse st = client.statObject(StatObjectArgs.builder().bucket(bucket).object(key).build());
            InputStream in = client.getObject(GetObjectArgs.builder().bucket(bucket).object(key).build());
            String ct = st.contentType();
            if (ct == null || ct.isBlank() || "application/octet-stream".equals(ct)) ct = contentTypeFor(key);
            return new StoredObject(in, st.size(), ct);
        } catch (ErrorResponseException e) {
            return null;   // not found
        } catch (Exception e) {
            log.debug("MinIO open failed for {}: {}", key, e.getMessage());
            return null;
        }
    }

    /** Deletes every object under the given key prefix from MinIO. */
    public void deletePrefix(String prefix) {
        String normalized = prefix.endsWith("/") ? prefix : prefix + "/";
        try {
            List<DeleteObject> toDelete = new ArrayList<>();
            Iterable<Result<Item>> objects = client.listObjects(ListObjectsArgs.builder()
                    .bucket(bucket).prefix(normalized).recursive(true).build());
            for (Result<Item> r : objects) toDelete.add(new DeleteObject(r.get().objectName()));
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
