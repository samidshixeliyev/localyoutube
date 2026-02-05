package az.dev.localtube.domain;

import java.time.LocalDateTime;

public class Comment {
    
    private String id;
    private String userId;
    private String username;
    private String text;
    private LocalDateTime createdAt;
    private Long likes;
    
    public Comment() {
        this.createdAt = LocalDateTime.now();
        this.likes = 0L;
    }
    
    public Comment(String userId, String username, String text) {
        this();
        this.userId = userId;
        this.username = username;
        this.text = text;
    }
    
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    
    public Long getLikes() { return likes; }
    public void setLikes(Long likes) { this.likes = likes; }
}