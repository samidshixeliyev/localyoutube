package az.dev.localtube.metrics;

import io.micrometer.core.instrument.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicLong;

/**
 * Custom Prometheus metrics for LocalTube
 */
@Slf4j
@Component
public class LocalTubeMetrics {

    private final MeterRegistry registry;

    // Upload metrics
    private final Counter uploadsTotal;
    private final Counter uploadsSuccess;
    private final Counter uploadsFailed;

    // Video metrics
    private final Counter videoViewsTotal;
    private final AtomicLong activeTranscodings;
    private final Gauge activeTranscodingsGauge;

    // Transcoding metrics
    private final Timer transcodingDuration;
    private final Counter transcodingSuccess;
    private final Counter transcodingFailed;

    // Elasticsearch metrics
    private final Counter esOperationsTotal;
    private final Timer esLatency;

    // Disk metrics
    private final AtomicLong diskUsageUploads;
    private final AtomicLong diskUsageHls;
    private final AtomicLong diskUsageThumbnails;

    public LocalTubeMetrics(MeterRegistry registry) {
        this.registry = registry;

        // ═══════════════════════════════════════════════════════════════════════
        // Upload Metrics
        // ═══════════════════════════════════════════════════════════════════════
        this.uploadsTotal = Counter.builder("localtube_uploads_total")
                .description("Total number of upload attempts")
                .register(registry);

        this.uploadsSuccess = Counter.builder("localtube_uploads_success")
                .description("Number of successful uploads")
                .register(registry);

        this.uploadsFailed = Counter.builder("localtube_uploads_failed")
                .description("Number of failed uploads")
                .register(registry);

        // ═══════════════════════════════════════════════════════════════════════
        // Video View Metrics
        // ═══════════════════════════════════════════════════════════════════════
        this.videoViewsTotal = Counter.builder("localtube_video_views_total")
                .description("Total video views")
                .register(registry);

        // ═══════════════════════════════════════════════════════════════════════
        // Transcoding Metrics
        // ═══════════════════════════════════════════════════════════════════════
        this.activeTranscodings = new AtomicLong(0);
        this.activeTranscodingsGauge = Gauge.builder("localtube_active_transcodings", activeTranscodings, AtomicLong::get)
                .description("Number of videos currently being transcoded")
                .register(registry);

        this.transcodingDuration = Timer.builder("localtube_transcoding_duration_seconds")
                .description("Time spent transcoding videos")
                .publishPercentiles(0.5, 0.9, 0.99)
                .register(registry);

        this.transcodingSuccess = Counter.builder("localtube_transcoding_success")
                .description("Number of successful transcodings")
                .register(registry);

        this.transcodingFailed = Counter.builder("localtube_transcoding_failed")
                .description("Number of failed transcodings")
                .register(registry);

        // ═══════════════════════════════════════════════════════════════════════
        // Elasticsearch Metrics
        // ═══════════════════════════════════════════════════════════════════════
        this.esOperationsTotal = Counter.builder("localtube_elasticsearch_operations_total")
                .description("Total Elasticsearch operations")
                .tag("operation", "all")
                .tag("status", "all")
                .register(registry);

        this.esLatency = Timer.builder("localtube_elasticsearch_latency_seconds")
                .description("Elasticsearch operation latency")
                .publishPercentiles(0.5, 0.9, 0.99)
                .register(registry);

        // ═══════════════════════════════════════════════════════════════════════
        // Disk Usage Metrics
        // ═══════════════════════════════════════════════════════════════════════
        this.diskUsageUploads = new AtomicLong(0);
        this.diskUsageHls = new AtomicLong(0);
        this.diskUsageThumbnails = new AtomicLong(0);

        Gauge.builder("localtube_disk_usage_bytes", diskUsageUploads, AtomicLong::get)
                .description("Disk usage in bytes")
                .tag("type", "uploads")
                .register(registry);

        Gauge.builder("localtube_disk_usage_bytes", diskUsageHls, AtomicLong::get)
                .description("Disk usage in bytes")
                .tag("type", "hls")
                .register(registry);

        Gauge.builder("localtube_disk_usage_bytes", diskUsageThumbnails, AtomicLong::get)
                .description("Disk usage in bytes")
                .tag("type", "thumbnails")
                .register(registry);

        log.info("LocalTube metrics initialized");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // Upload Recording Methods
    // ═══════════════════════════════════════════════════════════════════════════════
    
    public void recordUploadAttempt() {
        uploadsTotal.increment();
    }

    public void recordUploadSuccess() {
        uploadsSuccess.increment();
    }

    public void recordUploadFailure() {
        uploadsFailed.increment();
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // Video View Recording
    // ═══════════════════════════════════════════════════════════════════════════════
    
    public void recordVideoView() {
        videoViewsTotal.increment();
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // Transcoding Recording Methods
    // ═══════════════════════════════════════════════════════════════════════════════
    
    public void incrementActiveTranscodings() {
        activeTranscodings.incrementAndGet();
    }

    public void decrementActiveTranscodings() {
        activeTranscodings.decrementAndGet();
    }

    public void recordTranscodingDuration(long durationMs) {
        transcodingDuration.record(java.time.Duration.ofMillis(durationMs));
    }

    public void recordTranscodingSuccess() {
        transcodingSuccess.increment();
    }

    public void recordTranscodingFailure() {
        transcodingFailed.increment();
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // Elasticsearch Recording Methods
    // ═══════════════════════════════════════════════════════════════════════════════
    
    public void recordElasticsearchOperation(String operation, String status) {
        Counter.builder("localtube_elasticsearch_operations_total")
                .description("Total Elasticsearch operations")
                .tag("operation", operation)
                .tag("status", status)
                .register(registry)
                .increment();
    }

    public void recordElasticsearchLatency(long latencyMs) {
        esLatency.record(java.time.Duration.ofMillis(latencyMs));
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // Disk Usage Recording Methods
    // ═══════════════════════════════════════════════════════════════════════════════
    
    public void updateDiskUsage(long uploadsBytes, long hlsBytes, long thumbnailsBytes) {
        diskUsageUploads.set(uploadsBytes);
        diskUsageHls.set(hlsBytes);
        diskUsageThumbnails.set(thumbnailsBytes);
    }
}