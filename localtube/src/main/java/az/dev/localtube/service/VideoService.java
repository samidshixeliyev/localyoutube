package az.dev.localtube.service;

import az.dev.localtube.domain.Video;
import az.dev.localtube.domain.VideoStatus;
import az.dev.localtube.exception.BadRequestException;
import az.dev.localtube.repository.VideoRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
public class VideoService {

    private final VideoRepository videoRepository;
    private final Path uploadDir;
    private final Path hlsDir;
    private final Path thumbnailDir;

    public VideoService(VideoRepository videoRepository,
                        @Value("${localtube.storage.upload-dir}") String uploadDirPath,
                        @Value("${localtube.storage.hls-dir}") String hlsDirPath,
                        @Value("${localtube.storage.thumbnail-dir}") String thumbnailDirPath) {
        this.videoRepository = videoRepository;
        this.uploadDir = Paths.get(uploadDirPath);
        this.hlsDir = Paths.get(hlsDirPath);
        this.thumbnailDir = Paths.get(thumbnailDirPath);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Create
    // ═══════════════════════════════════════════════════════════════════════════

    public Video createVideo(String title, String filename, String description) throws IOException {
        return createVideo(title, filename, description, null, null, null);
    }

    public Video createVideo(String title, String filename, String description,
                             List<String> tags, Long uploaderId, String uploaderName) throws IOException {
        Video video = Video.builder()
                .title(title)
                .filename(filename)
                .originalFilename(filename)
                .description(description != null ? description : "")
                .tags(tags != null ? tags : List.of())
                .uploaderId(uploaderId)
                .uploaderName(uploaderName)
                .status(VideoStatus.UPLOADING)
                .uploadPath(uploadDir.resolve(filename).toString())
                .hlsPath(hlsDir.toString())
                .thumbnailPath(thumbnailDir.toString())
                .uploadedAt(LocalDateTime.now())
                .views(0L)
                .likes(0L)
                .commentCount(0)
                .build();

        video = videoRepository.save(video);
        
        // Update paths with video ID
        video.setUploadPath(uploadDir.resolve(video.getId()).toString());
        video.setHlsPath(hlsDir.resolve(video.getId()).toString());
        video.setThumbnailPath(thumbnailDir.resolve(video.getId()).toString());
        video.setMasterPlaylistUrl("/hls/" + video.getId() + "/master.m3u8");
        video.setThumbnailUrl("/thumbnails/" + video.getId() + "/default.jpg");
        
        return videoRepository.save(video);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Read
    // ═══════════════════════════════════════════════════════════════════════════

    public Optional<Video> getVideo(String id) throws IOException {
        return videoRepository.findById(id);
    }

    public List<Video> getAllVideos() throws IOException {
        return videoRepository.findAll();
    }

    public List<Video> getAllVideos(int page, int size) throws IOException {
        return videoRepository.findAll(page, size);
    }

    public List<Video> getPublicVideos(int page, int size) throws IOException {
        return videoRepository.findByStatusWithPagination(VideoStatus.READY, page, size);
    }

    public long countPublicVideos() throws IOException {
        return videoRepository.countByStatus(VideoStatus.READY);
    }

    public List<Video> getVideosByUploader(Long uploaderId, int page, int size) throws IOException {
        return videoRepository.findByUploaderId(uploaderId, page, size);
    }

    public long countVideosByUploader(Long uploaderId) throws IOException {
        return videoRepository.countByUploaderId(uploaderId);
    }

    public List<Video> getVideosByStatus(VideoStatus status) throws IOException {
        return videoRepository.findByStatus(status);
    }

    public List<Video> searchVideos(String query) throws IOException {
        return videoRepository.search(query);
    }

    public List<Video> searchVideos(String query, int page, int size) throws IOException {
        return videoRepository.search(query, page, size);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Update
    // ═══════════════════════════════════════════════════════════════════════════

    public Video updateVideo(Video video) throws IOException {
        video.setUpdatedAt(LocalDateTime.now());
        return videoRepository.save(video);
    }

    public void updateVideoStatus(String id, VideoStatus status) throws IOException {
        videoRepository.updateStatus(id, status);

        if (status == VideoStatus.READY) {
            Optional<Video> videoOpt = videoRepository.findById(id);
            if (videoOpt.isPresent()) {
                Video video = videoOpt.get();
                video.setProcessedAt(LocalDateTime.now());
                videoRepository.save(video);
            }
        }
    }

    public void addQualityToVideo(String id, String quality) throws IOException {
        Optional<Video> videoOpt = videoRepository.findById(id);
        if (videoOpt.isPresent()) {
            Video video = videoOpt.get();
            video.addQuality(quality);
            videoRepository.save(video);
            log.debug("Added quality {} to video {}", quality, id);
        }
    }

    public void updateVideoMetadata(String id, Integer width, Integer height, 
                                    Integer duration, Long fileSize) throws IOException {
        Optional<Video> videoOpt = videoRepository.findById(id);
        if (videoOpt.isPresent()) {
            Video video = videoOpt.get();
            video.setWidth(width);
            video.setHeight(height);
            video.setDurationSeconds(duration);
            video.setFileSize(fileSize);
            videoRepository.save(video);
        }
    }

    public void incrementViews(String id) throws IOException {
        Optional<Video> videoOpt = videoRepository.findById(id);
        if (videoOpt.isPresent()) {
            Video video = videoOpt.get();
            video.incrementViews();
            videoRepository.save(video);
        }
    }

    public void incrementLikes(String id) throws IOException {
        Optional<Video> videoOpt = videoRepository.findById(id);
        if (videoOpt.isPresent()) {
            Video video = videoOpt.get();
            video.incrementLikes();
            videoRepository.save(video);
        }
    }

    public void decrementLikes(String id) throws IOException {
        Optional<Video> videoOpt = videoRepository.findById(id);
        if (videoOpt.isPresent()) {
            Video video = videoOpt.get();
            video.decrementLikes();
            videoRepository.save(video);
        }
    }

    public void uploadCustomThumbnail(String videoId, MultipartFile file) throws IOException {
        Optional<Video> videoOpt = videoRepository.findById(videoId);
        if (videoOpt.isEmpty()) {
            throw new BadRequestException("Video not found: " + videoId);
        }

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

        // Update video thumbnail URL
        Video video = videoOpt.get();
        video.setThumbnailUrl("/thumbnails/" + videoId + "/custom." + extension);
        videoRepository.save(video);

        log.info("Custom thumbnail uploaded for video: {}", videoId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Delete
    // ═══════════════════════════════════════════════════════════════════════════

    public void deleteVideo(String id) throws IOException {
        Optional<Video> videoOpt = videoRepository.findById(id);
        if (videoOpt.isPresent()) {
            Video video = videoOpt.get();

            // Delete upload directory
            if (video.getUploadPath() != null) {
                deleteDirectoryRecursive(Paths.get(video.getUploadPath()));
            }

            // Delete HLS directory
            if (video.getHlsPath() != null) {
                deleteDirectoryRecursive(Paths.get(video.getHlsPath()));
            }

            // Delete thumbnail directory
            if (video.getThumbnailPath() != null) {
                deleteDirectoryRecursive(Paths.get(video.getThumbnailPath()));
            }

            videoRepository.delete(id);
            log.info("Deleted video and files: {}", id);
        }
    }

    private void deleteDirectoryRecursive(Path dir) {
        try {
            if (Files.exists(dir)) {
                Files.walk(dir)
                        .sorted((a, b) -> b.compareTo(a))
                        .forEach(p -> {
                            try {
                                Files.deleteIfExists(p);
                            } catch (IOException e) {
                                log.warn("Cannot delete: {}", p);
                            }
                        });
            }
        } catch (IOException e) {
            log.warn("Delete failed: {}", dir);
        }
    }

    private String getFileExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "jpg";
        }
        return filename.substring(filename.lastIndexOf('.') + 1);
    }
}