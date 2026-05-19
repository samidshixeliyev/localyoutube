package ao.az.modtube.service;

import ao.az.modtube.domain.Video;
import ao.az.modtube.domain.VideoLike;
import ao.az.modtube.domain.VideoStatus;
import ao.az.modtube.exception.BadRequestException;
import ao.az.modtube.repository.CommentRepository;
import ao.az.modtube.repository.VideoLikeRepository;
import ao.az.modtube.repository.VideoRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import org.springframework.data.domain.PageRequest;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
public class VideoService {

    private final VideoRepository videoRepository;
    private final VideoLikeRepository videoLikeRepository;
    private final CommentRepository commentRepository;
    private final Path uploadDir;
    private final Path hlsDir;
    private final Path thumbnailDir;

    public VideoService(VideoRepository videoRepository, VideoLikeRepository videoLikeRepository,
                        CommentRepository commentRepository,
                        @Value("${modtube.storage.upload-dir}") String uploadDirPath,
                        @Value("${modtube.storage.hls-dir}") String hlsDirPath,
                        @Value("${modtube.storage.thumbnail-dir}") String thumbnailDirPath) {
        this.videoRepository = videoRepository;
        this.videoLikeRepository = videoLikeRepository;
        this.commentRepository = commentRepository;
        this.uploadDir = Paths.get(uploadDirPath);
        this.hlsDir = Paths.get(hlsDirPath);
        this.thumbnailDir = Paths.get(thumbnailDirPath);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Create
    // ═══════════════════════════════════════════════════════════════════════════

    @Transactional
    public Video createVideo(String title, String filename, String description) {
        return createVideo(title, filename, description, null, null, null);
    }

    @Transactional
    public Video createVideo(String title, String filename, String description,
                             List<String> tags, Long uploaderId, String uploaderName) {
        return createVideo(title, filename, description, tags, uploaderId, uploaderName, null);
    }

    @Transactional
    public Video createVideo(String title, String filename, String description,
                             List<String> tags, Long uploaderId, String uploaderName,
                             String uploaderEmail) {
        String videoId = UUID.randomUUID().toString().replace("-", "");

        Video video = Video.builder()
                .id(videoId)
                .title(title)
                .filename(filename)
                .originalFilename(filename)
                .description(description != null ? description : "")
                .tags(tags != null ? new ArrayList<>(tags) : new ArrayList<>())
                .uploaderId(uploaderId)
                .uploaderName(uploaderName)
                .uploaderEmail(uploaderEmail)
                .status(VideoStatus.UPLOADING)
                .uploadPath(uploadDir.resolve(videoId).toString())
                .hlsPath(hlsDir.resolve(videoId).toString())
                .thumbnailPath(thumbnailDir.resolve(videoId).toString())
                .masterPlaylistUrl("/hls/" + videoId + "/master.m3u8")
                .thumbnailUrl("/thumbnails/" + videoId + "/default.jpg")
                .views(0L)
                .likes(0L)
                .commentCount(0)
                .build();

        video.setUploadedAtDateTime(LocalDateTime.now());
        video.markAsNew();
        video = videoRepository.save(video);
        log.info("Created video with UUID: {}, filename: {}", videoId, filename);
        return video;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Read
    // ═══════════════════════════════════════════════════════════════════════════

    public Optional<Video> getVideo(String id) {
        return videoRepository.findById(id);
    }

    public List<Video> getAllVideos() {
        return videoRepository.findAllOrdered();
    }

    public List<Video> getAllVideos(int page, int size) {
        return videoRepository.findAll(page, size);
    }

    public List<Video> getVideosByUploader(Long uploaderId, int page, int size) {
        return videoRepository.findByUploaderId(uploaderId, page, size);
    }

    public long countVideosByUploader(Long uploaderId) {
        return videoRepository.countByUploaderId(uploaderId);
    }

    public List<Video> getVideosByStatus(VideoStatus status) {
        return videoRepository.findByStatus(status);
    }

    public List<Video> getVideosByStatusIn(List<VideoStatus> statuses) {
        return videoRepository.findByStatusIn(statuses);
    }

    public List<Video> searchVideos(String query) {
        return searchVideos(query, 0, 20, null);
    }

    public List<Video> searchVideos(String query, int page, int size) {
        return searchVideos(query, page, size, null);
    }

    public List<Video> searchVideos(String query, int page, int size, String userEmail) {
        return videoRepository.search(query, page, size, userEmail);
    }

    public List<Video> getPublicVideos(int page, int size) {
        return getPublicVideos(page, size, null);
    }

    public List<Video> getPublicVideos(int page, int size, String userEmail) {
        return videoRepository.findPublicVideos(page, size, userEmail);
    }

    public long countPublicVideos() {
        return countPublicVideos(null);
    }

    public long countPublicVideos(String userEmail) {
        return videoRepository.countPublicVideos(userEmail);
    }

    public List<Video> getAllReadyVideos(int page, int size) {
        return videoRepository.findAllReadyVideos(page, size);
    }

    public long countAllReadyVideos() {
        return videoRepository.countAllReadyVideos();
    }

    public List<Video> getSuggestionsByTags(List<String> tags, String excludeVideoId, int size) {
        return videoRepository.findByTags(tags, excludeVideoId, size);
    }

    public List<String> getTitleSuggestions(String query, int size) {
        return videoRepository.findTitleSuggestions(query, PageRequest.of(0, size));
    }

    public List<Video> getShorts(int page, int size, String userEmail) {
        List<String> visibilities = (userEmail != null)
                ? List.of("PUBLIC", "UNLISTED")
                : List.of("PUBLIC");
        return videoRepository.findShortsPaged(visibilities, page * size, size);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Update
    // ═══════════════════════════════════════════════════════════════════════════

    @Transactional
    public Video updateVideo(Video video) {
        video.setUpdatedAtDateTime(LocalDateTime.now());
        return videoRepository.save(video);
    }

    @Transactional
    public void updateVideoStatus(String id, VideoStatus status) {
        videoRepository.updateStatus(id, status);
        if (status == VideoStatus.READY) {
            videoRepository.findById(id).ifPresent(video -> {
                video.setProcessedAtDateTime(LocalDateTime.now());
                videoRepository.save(video);
            });
        }
    }

    @Transactional
    public void addQualityToVideo(String id, String quality) {
        videoRepository.findById(id).ifPresent(video -> {
            video.addQuality(quality);
            videoRepository.save(video);
            log.debug("Added quality {} to video {}", quality, id);
        });
    }

    @Transactional
    public void updateProcessingProgress(String id, int progress) {
        videoRepository.findById(id).ifPresent(video -> {
            video.setProcessingProgress(Math.min(100, Math.max(0, progress)));
            videoRepository.save(video);
        });
    }

    @Transactional
    public void updateVideoMetadata(String id, Integer width, Integer height,
                                    Integer duration, Long fileSize) {
        videoRepository.findById(id).ifPresent(video -> {
            video.setWidth(width);
            video.setHeight(height);
            video.setDurationSeconds(duration);
            video.setFileSize(fileSize);
            videoRepository.save(video);
        });
    }

    @Transactional
    public void incrementViews(String id) {
        videoRepository.findById(id).ifPresent(video -> {
            video.incrementViews();
            videoRepository.save(video);
        });
    }

    @Transactional
    public void incrementLikes(String id) {
        videoRepository.findById(id).ifPresent(video -> {
            video.incrementLikes();
            videoRepository.save(video);
        });
    }

    @Transactional
    public void decrementLikes(String id) {
        videoRepository.findById(id).ifPresent(video -> {
            video.decrementLikes();
            videoRepository.save(video);
        });
    }

    public void uploadCustomThumbnail(String videoId, MultipartFile file) throws IOException {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new BadRequestException("Video not found: " + videoId));

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new BadRequestException("File must be an image");
        }

        Path thumbDir = thumbnailDir.resolve(videoId);
        Files.createDirectories(thumbDir);

        String extension = getFileExtension(file.getOriginalFilename());
        Path customThumbnail = thumbDir.resolve("custom." + extension);

        try (InputStream in = file.getInputStream()) {
            Files.copy(in, customThumbnail, StandardCopyOption.REPLACE_EXISTING);
        }

        video.setThumbnailUrl("/thumbnails/" + videoId + "/custom." + extension);
        videoRepository.save(video);
        log.info("Custom thumbnail uploaded for video: {}", videoId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Delete
    // ═══════════════════════════════════════════════════════════════════════════

    @Transactional
    public void deleteVideo(String id) throws IOException {
        Optional<Video> videoOpt = videoRepository.findById(id);
        if (videoOpt.isPresent()) {
            Video video = videoOpt.get();

            if (video.getUploadPath() != null) {
                deleteDirectoryRecursive(Paths.get(video.getUploadPath()));
            }
            if (video.getHlsPath() != null) {
                deleteDirectoryRecursive(Paths.get(video.getHlsPath()));
            }
            if (video.getThumbnailPath() != null) {
                deleteDirectoryRecursive(Paths.get(video.getThumbnailPath()));
            }

            commentRepository.deleteByVideoId(id);
            videoLikeRepository.deleteByVideoId(id);
            videoRepository.deleteById(id);
            log.info("Deleted video and files: {}", id);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Stats
    // ═══════════════════════════════════════════════════════════════════════════

    public long countByStatus(VideoStatus status) {
        return videoRepository.countByStatus(status);
    }

    public long getTotalViews() {
        return videoRepository.sumViews();
    }

    public long getTotalFileSizeBytes() {
        return videoRepository.sumFileSizeBytes();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Like methods
    // ═══════════════════════════════════════════════════════════════════════════

    @Transactional
    public synchronized boolean toggleLike(String videoId, String userEmail) {
        if (videoId == null || userEmail == null) {
            throw new IllegalArgumentException("videoId and userEmail cannot be null");
        }

        String normalizedEmail = userEmail.toLowerCase().trim();
        log.info("Toggle like: videoId={}, userEmail={}", videoId, normalizedEmail);

        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new RuntimeException("Video not found: " + videoId));

        boolean alreadyLiked = videoLikeRepository.existsByVideoIdAndUserEmail(videoId, normalizedEmail);

        if (alreadyLiked) {
            videoLikeRepository.deleteByEmail(videoId, normalizedEmail);
            video.decrementLikes();
            videoRepository.save(video);
            log.info("Unliked video {} by user {}", videoId, normalizedEmail);
            return false;
        } else {
            VideoLike like = VideoLike.builder()
                    .id(VideoLike.generateId(videoId, normalizedEmail))
                    .videoId(videoId)
                    .userEmail(normalizedEmail)
                    .createdAt(System.currentTimeMillis())
                    .build();
            videoLikeRepository.save(like);
            video.incrementLikes();
            videoRepository.save(video);
            log.info("Liked video {} by user {}", videoId, normalizedEmail);
            return true;
        }
    }

    public boolean isLikedByUser(String videoId, String userEmail) {
        if (videoId == null || userEmail == null) return false;
        return videoLikeRepository.existsByVideoIdAndUserEmail(videoId, userEmail.toLowerCase().trim());
    }

    @Transactional
    public void removeLike(String videoId, String userEmail) {
        if (videoId == null || userEmail == null) {
            throw new IllegalArgumentException("videoId and userEmail cannot be null");
        }
        String normalizedEmail = userEmail.toLowerCase().trim();
        boolean wasLiked = videoLikeRepository.existsByVideoIdAndUserEmail(videoId, normalizedEmail);
        if (wasLiked) {
            videoLikeRepository.deleteByEmail(videoId, normalizedEmail);
            decrementLikes(videoId);
            log.info("Removed like: videoId={}, userEmail={}", videoId, normalizedEmail);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    private void deleteDirectoryRecursive(Path dir) {
        try {
            if (Files.exists(dir)) {
                Files.walk(dir)
                        .sorted((a, b) -> b.compareTo(a))
                        .forEach(p -> {
                            try { Files.deleteIfExists(p); } catch (IOException e) { log.warn("Cannot delete: {}", p); }
                        });
            }
        } catch (IOException e) {
            log.warn("Delete failed: {}", dir);
        }
    }

    private String getFileExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "jpg";
        return filename.substring(filename.lastIndexOf('.') + 1);
    }
}
