package az.dev.localtube.service;

import az.dev.localtube.domain.Comment;
import az.dev.localtube.domain.Video;
import az.dev.localtube.domain.VideoStatus;
import az.dev.localtube.repository.VideoRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class VideoService {

    private final VideoRepository videoRepository;
    private final Path uploadDir;
    private final Path hlsDir;

    public VideoService(VideoRepository videoRepository,
                        @Value("${localtube.storage.upload-dir}") String uploadDirPath,
                        @Value("${localtube.storage.hls-dir}") String hlsDirPath) {
        this.videoRepository = videoRepository;
        this.uploadDir = Paths.get(uploadDirPath);
        this.hlsDir = Paths.get(hlsDirPath);
    }

    public Video createVideo(String title, String filename, String description) throws IOException {
        String videoId = sanitizeFilename(filename);

        Video video = new Video();
        video.setId(videoId);
        video.setTitle(title);
        video.setFilename(filename);
        video.setDescription(description);
        video.setStatus(VideoStatus.UPLOADING);
        video.setUploadPath(uploadDir.resolve(filename).toString());
        video.setHlsPath(hlsDir.resolve(videoId).toString());
        video.setMasterPlaylistUrl("/hls/" + videoId + "/master.m3u8");

        return videoRepository.save(video);
    }

    public Optional<Video> getVideo(String id) throws IOException {
        return videoRepository.findById(id);
    }

    public List<Video> getAllVideos() throws IOException {
        return videoRepository.findAll();
    }

    public List<Video> getVideosByStatus(VideoStatus status) throws IOException {
        return videoRepository.findByStatus(status);
    }

    public List<Video> searchVideos(String query) throws IOException {
        return videoRepository.search(query);
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
        videoRepository.addQuality(id, quality);
    }

    public void updateVideoMetadata(String id, Integer width, Integer height, Integer duration, Long fileSize) throws IOException {
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
        videoRepository.incrementViews(id);
    }

    public void incrementLikes(String id) throws IOException {
        videoRepository.incrementLikes(id);
    }

    public void addComment(String videoId, String userId, String username, String text) throws IOException {
        Comment comment = new Comment(userId, username, text);
        videoRepository.addComment(videoId, comment);
    }

    public void deleteVideo(String id) throws IOException {
        Optional<Video> videoOpt = videoRepository.findById(id);
        if (videoOpt.isPresent()) {
            Video video = videoOpt.get();

            if (video.getUploadPath() != null) {
                Path uploadPath = Paths.get(video.getUploadPath());
                Files.deleteIfExists(uploadPath);
            }

            if (video.getHlsPath() != null) {
                Path hlsPath = Paths.get(video.getHlsPath());
                deleteDirectoryRecursive(hlsPath);
            }

            videoRepository.delete(id);
        }
    }

    private String sanitizeFilename(String filename) {
        String name = filename;
        if (name.contains(".")) {
            name = name.substring(0, name.lastIndexOf('.'));
        }
        return name.replaceAll("[^a-zA-Z0-9._-]", "_")
                .replaceAll("_+", "_")
                .replaceAll("^[._-]+", "");
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
                                System.err.println("[VideoService] Cannot delete: " + p);
                            }
                        });
            }
        } catch (IOException e) {
            System.err.println("[VideoService] Delete failed: " + dir);
        }
    }
}