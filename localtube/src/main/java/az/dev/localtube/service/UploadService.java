package az.dev.localtube.service;

import az.dev.localtube.config.security.LocalTubeUserDetails;
import az.dev.localtube.domain.Video;
import az.dev.localtube.dto.VideoDto.*;
import az.dev.localtube.exception.BadRequestException;
import az.dev.localtube.exception.InsufficientStorageException;
import az.dev.localtube.metrics.LocalTubeMetrics;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.*;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Upload service - handles chunked video uploads
 */
@Slf4j
@Service
public class UploadService {

    private final VideoService videoService;
    private final TranscodingService transcodingService;
    private final LocalTubeMetrics metrics;

    private final Path uploadDir;
    private final Path tempDir;
    private final long maxFileSize;
    private final long minDiskFree;
    private final List<String> allowedExtensions;

    private static final int BUFFER_SIZE = 8 * 1024;

    private final ConcurrentHashMap<String, UploadSession> activeSessions = new ConcurrentHashMap<>();

    private volatile long cachedFreeSpace = Long.MAX_VALUE;
    private volatile long cacheTimestamp = 0;
    private static final long CACHE_TTL_MS = 1000;

    public UploadService(
            VideoService videoService,
            TranscodingService transcodingService,
            LocalTubeMetrics metrics,
            @Value("${localtube.storage.upload-dir}") String uploadDirPath,
            @Value("${localtube.storage.temp-dir}") String tempDirPath,
            @Value("${localtube.storage.max-file-size}") long maxFileSize,
            @Value("${localtube.storage.min-disk-free}") long minDiskFree,
            @Value("${localtube.storage.allowed-extensions}") List<String> allowedExtensions
    ) {
        this.videoService = videoService;
        this.transcodingService = transcodingService;
        this.metrics = metrics;
        this.uploadDir = Paths.get(uploadDirPath);
        this.tempDir = Paths.get(tempDirPath);
        this.maxFileSize = maxFileSize;
        this.minDiskFree = minDiskFree;
        this.allowedExtensions = allowedExtensions;
    }

    @PostConstruct
    public void init() throws IOException {
        Files.createDirectories(uploadDir);
        Files.createDirectories(tempDir);
        log.info("Upload service initialized: upload={}, temp={}", uploadDir, tempDir);
    }

    public InitUploadResponse initUpload(InitUploadRequest request, LocalTubeUserDetails user) 
            throws IOException {
        metrics.recordUploadAttempt();

        String extension = getFileExtension(request.getFilename());
        if (!allowedExtensions.contains(extension.toLowerCase())) {
            throw new BadRequestException("File type not allowed. Allowed: " + allowedExtensions);
        }

        if (request.getTotalSize() > maxFileSize) {
            throw new BadRequestException(String.format(
                    "File too large. Maximum size: %d GB",
                    maxFileSize / (1024 * 1024 * 1024)
            ));
        }

        long freeSpace = getFreeSpace();
        if (freeSpace < request.getTotalSize() + minDiskFree) {
            throw new InsufficientStorageException(String.format(
                    "Not enough disk space. Free: %d GB, Required: %d GB",
                    freeSpace / (1024 * 1024 * 1024),
                    (request.getTotalSize() + minDiskFree) / (1024 * 1024 * 1024)
            ));
        }

        Video video = videoService.createVideo(
                request.getTitle() != null ? request.getTitle() : request.getFilename(),
                request.getFilename(),
                request.getDescription(),
                request.getTags(),
                user
        );

        String uploadId = video.getId() + "_" + System.currentTimeMillis();
        UploadSession session = new UploadSession(
                uploadId,
                video.getId(),
                request.getFilename(),
                request.getTotalSize(),
                request.getTotalChunks()
        );
        activeSessions.put(uploadId, session);

        Path tempFile = tempDir.resolve(video.getId() + "." + extension);
        session.setTempFilePath(tempFile);

        log.info("[Upload] Initialized: videoId={}, uploadId={}, size={} MB, chunks={}",
                video.getId(), uploadId, request.getTotalSize() / (1024 * 1024), request.getTotalChunks());

        return InitUploadResponse.builder()
                .status("initialized")
                .videoId(video.getId())
                .uploadId(uploadId)
                .message("Upload initialized. Ready to receive chunks.")
                .build();
    }

    public ChunkUploadResponse uploadChunk(
            MultipartFile chunk,
            int chunkIndex,
            int totalChunks,
            String filename,
            String uploadId
    ) throws IOException {
        UploadSession session = activeSessions.get(uploadId);
        if (session == null) {
            throw new BadRequestException("Upload session not found or expired: " + uploadId);
        }

        if (chunkIndex < 0 || chunkIndex >= totalChunks) {
            throw new BadRequestException("Invalid chunk index: " + chunkIndex);
        }

        if (getFreeSpace() < minDiskFree) {
            cleanupSession(session);
            throw new InsufficientStorageException("Disk space critically low");
        }

        Path tempFile = session.getTempFilePath();
        StandardOpenOption[] options = (chunkIndex == 0)
                ? new StandardOpenOption[]{StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.WRITE}
                : new StandardOpenOption[]{StandardOpenOption.CREATE, StandardOpenOption.APPEND, StandardOpenOption.WRITE};

        try (OutputStream out = Files.newOutputStream(tempFile, options);
             InputStream in = chunk.getInputStream()) {
            byte[] buffer = new byte[BUFFER_SIZE];
            int bytesRead;
            while ((bytesRead = in.read(buffer)) != -1) {
                out.write(buffer, 0, bytesRead);
            }
        }

        session.markChunkComplete(chunkIndex);
        double progress = (double) (chunkIndex + 1) / totalChunks * 100;

        log.debug("[Upload] Chunk {}/{} received for {}", chunkIndex + 1, totalChunks, session.getVideoId());

        return ChunkUploadResponse.builder()
                .status("chunk_received")
                .chunkIndex(chunkIndex)
                .progress(String.format("%.1f%%", progress))
                .message(String.format("Chunk %d of %d received", chunkIndex + 1, totalChunks))
                .build();
    }

    public CompleteUploadResponse completeUpload(CompleteUploadRequest request) throws IOException {
        UploadSession session = null;
        for (UploadSession s : activeSessions.values()) {
            if (s.getVideoId().equals(request.getVideoId())) {
                session = s;
                break;
            }
        }

        if (session == null) {
            throw new BadRequestException("Upload session not found for video: " + request.getVideoId());
        }

        Path tempFile = session.getTempFilePath();

        if (!Files.exists(tempFile)) {
            cleanupSession(session);
            throw new BadRequestException("Upload file not found");
        }

        long actualSize = Files.size(tempFile);
        if (session.getTotalSize() > 0 && Math.abs(actualSize - session.getTotalSize()) > 1024) {
            log.warn("[Upload] Size mismatch: expected={}, actual={}", session.getTotalSize(), actualSize);
        }

        Path videoDir = uploadDir.resolve(session.getVideoId());
        Files.createDirectories(videoDir);
        
        String extension = getFileExtension(session.getFilename());
        Path finalFile = videoDir.resolve("original." + extension);
        Files.move(tempFile, finalFile, StandardCopyOption.REPLACE_EXISTING);

        activeSessions.remove(session.getUploadId());

        transcodingService.transcodeToHLS(session.getVideoId(), finalFile);

        metrics.recordUploadSuccess();
        log.info("[Upload] Complete: videoId={}, size={} MB", 
                session.getVideoId(), actualSize / (1024 * 1024));

        return CompleteUploadResponse.builder()
                .status("processing_started")
                .videoId(session.getVideoId())
                .hlsUrl("/hls/" + session.getVideoId() + "/master.m3u8")
                .message("Upload complete. Transcoding started.")
                .build();
    }

    public void cancelUpload(String uploadId) throws IOException {
        UploadSession session = activeSessions.get(uploadId);
        if (session != null) {
            cleanupSession(session);
            log.info("[Upload] Cancelled: {}", uploadId);
        }
    }

    public void uploadThumbnail(String videoId, MultipartFile file, LocalTubeUserDetails user) 
            throws IOException {
        var video = videoService.getVideo(videoId)
                .orElseThrow(() -> new BadRequestException("Video not found: " + videoId));

        if (!video.getUploaderId().equals(user.getUserId()) && !user.isAdmin()) {
            throw new BadRequestException("You can only upload thumbnails for your own videos");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new BadRequestException("File must be an image");
        }

        Path thumbnailDir = Paths.get(video.getThumbnailPath());
        Files.createDirectories(thumbnailDir);
        
        String extension = getFileExtension(file.getOriginalFilename());
        Path customThumbnail = thumbnailDir.resolve("custom." + extension);
        
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, customThumbnail, StandardCopyOption.REPLACE_EXISTING);
        }

        log.info("[Thumbnail] Custom uploaded for video: {}", videoId);
    }

    private void cleanupSession(UploadSession session) {
        try {
            if (session.getTempFilePath() != null) {
                Files.deleteIfExists(session.getTempFilePath());
            }
            activeSessions.remove(session.getUploadId());
        } catch (IOException e) {
            log.error("[Upload] Cleanup failed: {}", e.getMessage());
        }
    }

    private String getFileExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf('.') + 1);
    }

    private long getFreeSpace() {
        long now = System.currentTimeMillis();
        if (now - cacheTimestamp > CACHE_TTL_MS) {
            try {
                cachedFreeSpace = Files.getFileStore(uploadDir).getUsableSpace();
                cacheTimestamp = now;
            } catch (IOException e) {
                log.error("[Upload] Failed to check disk space: {}", e.getMessage());
            }
        }
        return cachedFreeSpace;
    }

    private static class UploadSession {
        private final String uploadId;
        private final String videoId;
        private final String filename;
        private final long totalSize;
        private final int totalChunks;
        private final boolean[] completedChunks;
        private Path tempFilePath;

        public UploadSession(String uploadId, String videoId, String filename, 
                           long totalSize, int totalChunks) {
            this.uploadId = uploadId;
            this.videoId = videoId;
            this.filename = filename;
            this.totalSize = totalSize;
            this.totalChunks = totalChunks;
            this.completedChunks = new boolean[totalChunks];
        }

        public String getUploadId() { return uploadId; }
        public String getVideoId() { return videoId; }
        public String getFilename() { return filename; }
        public long getTotalSize() { return totalSize; }
        public Path getTempFilePath() { return tempFilePath; }
        public void setTempFilePath(Path path) { this.tempFilePath = path; }

        public void markChunkComplete(int index) {
            if (index >= 0 && index < totalChunks) {
                completedChunks[index] = true;
            }
        }
    }
}