package az.dev.localtube.domain;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class Video {

    private String id;
    private String title;
    private String description;
    private String filename;
    private String uploadPath;
    private String hlsPath;
    private String masterPlaylistUrl;

    private VideoStatus status;
    private List<String> availableQualities;

    private Long fileSize;
    private Integer durationSeconds;
    private Integer width;
    private Integer height;

    private Long views;
    private Long likes;
    private List<Comment> comments;

    private LocalDateTime uploadedAt;
    private LocalDateTime processedAt;

    public Video() {
        this.availableQualities = new ArrayList<>();
        this.comments = new ArrayList<>();
        this.views = 0L;
        this.likes = 0L;
        this.status = VideoStatus.UPLOADING;
        this.uploadedAt = LocalDateTime.now();
    }

    public Video(String id, String title, String filename) {
        this();
        this.id = id;
        this.title = title;
        this.filename = filename;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getFilename() { return filename; }
    public void setFilename(String filename) { this.filename = filename; }

    public String getUploadPath() { return uploadPath; }
    public void setUploadPath(String uploadPath) { this.uploadPath = uploadPath; }

    public String getHlsPath() { return hlsPath; }
    public void setHlsPath(String hlsPath) { this.hlsPath = hlsPath; }

    public String getMasterPlaylistUrl() { return masterPlaylistUrl; }
    public void setMasterPlaylistUrl(String masterPlaylistUrl) { this.masterPlaylistUrl = masterPlaylistUrl; }

    public VideoStatus getStatus() { return status; }
    public void setStatus(VideoStatus status) { this.status = status; }

    public List<String> getAvailableQualities() { return availableQualities; }
    public void setAvailableQualities(List<String> availableQualities) { this.availableQualities = availableQualities; }

    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }

    public Integer getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(Integer durationSeconds) { this.durationSeconds = durationSeconds; }

    public Integer getWidth() { return width; }
    public void setWidth(Integer width) { this.width = width; }

    public Integer getHeight() { return height; }
    public void setHeight(Integer height) { this.height = height; }

    public Long getViews() { return views; }
    public void setViews(Long views) { this.views = views; }

    public Long getLikes() { return likes; }
    public void setLikes(Long likes) { this.likes = likes; }

    public List<Comment> getComments() { return comments; }
    public void setComments(List<Comment> comments) { this.comments = comments; }

    public LocalDateTime getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(LocalDateTime uploadedAt) { this.uploadedAt = uploadedAt; }

    public LocalDateTime getProcessedAt() { return processedAt; }
    public void setProcessedAt(LocalDateTime processedAt) { this.processedAt = processedAt; }

    public void addQuality(String quality) {
        if (!this.availableQualities.contains(quality)) {
            this.availableQualities.add(quality);
        }
    }

    public void incrementViews() { this.views++; }
    public void incrementLikes() { this.likes++; }
    public void addComment(Comment comment) { this.comments.add(comment); }
}