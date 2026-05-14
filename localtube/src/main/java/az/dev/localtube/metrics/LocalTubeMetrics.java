package az.dev.localtube.metrics;

import io.micrometer.core.instrument.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Stream;

/**
 * Custom Prometheus metrics for LocalTube.
 *
 * Metrics exposed at /actuator/prometheus:
 *   localtube_uploads_total              — counter, completed uploads
 *   localtube_uploads_success_total      — counter, successful uploads
 *   localtube_uploads_failed_total       — counter, failed uploads
 *   localtube_video_views_total          — counter, video detail opens
 *   localtube_active_transcodings        — gauge,   FFmpeg jobs running now
 *   localtube_transcoding_duration_*     — timer,   FFmpeg job duration
 *   localtube_transcoding_success_total  — counter
 *   localtube_transcoding_failed_total   — counter
 *   localtube_disk_usage_bytes{type}     — gauge,   dir sizes (auto-scanned every 60 s)
 */
@Slf4j
@Component
public class LocalTubeMetrics {

    private final MeterRegistry registry;
    private final Path uploadDir;
    private final Path hlsDir;
    private final Path thumbnailDir;

    // Upload metrics
    private final Counter uploadsTotal;
    private final Counter uploadsSuccess;
    private final Counter uploadsFailed;

    // Video metrics
    private final Counter videoViewsTotal;
    private final AtomicLong activeTranscodings;

    // Transcoding metrics
    private final Timer transcodingDuration;
    private final Counter transcodingSuccess;
    private final Counter transcodingFailed;

    // Disk metrics (updated by @Scheduled scanner)
    private final AtomicLong diskUsageUploads    = new AtomicLong(0);
    private final AtomicLong diskUsageHls        = new AtomicLong(0);
    private final AtomicLong diskUsageThumbnails = new AtomicLong(0);

    public LocalTubeMetrics(
            MeterRegistry registry,
            @Value("${localtube.storage.upload-dir}")    String uploadDirPath,
            @Value("${localtube.storage.hls-dir}")       String hlsDirPath,
            @Value("${localtube.storage.thumbnail-dir}") String thumbnailDirPath) {

        this.registry     = registry;
        this.uploadDir    = Paths.get(uploadDirPath);
        this.hlsDir       = Paths.get(hlsDirPath);
        this.thumbnailDir = Paths.get(thumbnailDirPath);

        // ── Upload Metrics ────────────────────────────────────────────────────
        this.uploadsTotal   = Counter.builder("localtube_uploads_total")
                .description("Total upload attempts").register(registry);
        this.uploadsSuccess = Counter.builder("localtube_uploads_success")
                .description("Successful uploads").register(registry);
        this.uploadsFailed  = Counter.builder("localtube_uploads_failed")
                .description("Failed uploads").register(registry);

        // ── Video View Metrics ────────────────────────────────────────────────
        this.videoViewsTotal = Counter.builder("localtube_video_views_total")
                .description("Total video views").register(registry);

        // ── Transcoding Metrics ───────────────────────────────────────────────
        this.activeTranscodings = new AtomicLong(0);
        Gauge.builder("localtube_active_transcodings", activeTranscodings, AtomicLong::get)
                .description("FFmpeg transcoding jobs in progress").register(registry);

        this.transcodingDuration = Timer.builder("localtube_transcoding_duration_seconds")
                .description("FFmpeg job duration").publishPercentiles(0.5, 0.9, 0.99)
                .register(registry);
        this.transcodingSuccess = Counter.builder("localtube_transcoding_success")
                .description("Successful transcodings").register(registry);
        this.transcodingFailed  = Counter.builder("localtube_transcoding_failed")
                .description("Failed transcodings").register(registry);

        // ── Disk Usage Gauges (backed by AtomicLong, scanned every 60 s) ─────
        Gauge.builder("localtube_disk_usage_bytes", diskUsageUploads, AtomicLong::get)
                .description("Bytes in uploads dir").tag("type", "uploads").register(registry);
        Gauge.builder("localtube_disk_usage_bytes", diskUsageHls, AtomicLong::get)
                .description("Bytes in HLS dir").tag("type", "hls").register(registry);
        Gauge.builder("localtube_disk_usage_bytes", diskUsageThumbnails, AtomicLong::get)
                .description("Bytes in thumbnails dir").tag("type", "thumbnails").register(registry);

        log.info("[Metrics] LocalTube Micrometer metrics registered");
    }

    // ── Scheduled disk scanner (runs every 60 s) ──────────────────────────────

    @Scheduled(fixedDelay = 60_000, initialDelay = 5_000)
    public void scanDiskUsage() {
        diskUsageUploads.set(dirSize(uploadDir));
        diskUsageHls.set(dirSize(hlsDir));
        diskUsageThumbnails.set(dirSize(thumbnailDir));
    }

    // ── Public API called from controllers / services ─────────────────────────

    public void recordUploadAttempt()  { uploadsTotal.increment(); }
    public void recordUploadSuccess()  { uploadsSuccess.increment(); }
    public void recordUploadFailure()  { uploadsFailed.increment(); }

    public void recordVideoView()      { videoViewsTotal.increment(); }

    public void incrementActiveTranscodings() { activeTranscodings.incrementAndGet(); }
    public void decrementActiveTranscodings() {
        long v = activeTranscodings.decrementAndGet();
        if (v < 0) activeTranscodings.set(0);
    }

    public void recordTranscodingDuration(long durationMs) {
        transcodingDuration.record(java.time.Duration.ofMillis(durationMs));
    }
    public void recordTranscodingSuccess() { transcodingSuccess.increment(); }
    public void recordTranscodingFailure() { transcodingFailed.increment(); }

    // ── Internals ─────────────────────────────────────────────────────────────

    private long dirSize(Path dir) {
        try {
            if (!Files.exists(dir)) return 0L;
            try (Stream<Path> walk = Files.walk(dir)) {
                return walk.filter(Files::isRegularFile)
                        .mapToLong(p -> { try { return Files.size(p); } catch (IOException e) { return 0L; } })
                        .sum();
            }
        } catch (IOException e) {
            log.debug("[Metrics] dirSize error for {}: {}", dir, e.getMessage());
            return 0L;
        }
    }
}