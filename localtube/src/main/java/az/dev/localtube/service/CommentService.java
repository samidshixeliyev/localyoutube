package az.dev.localtube.service;

import az.dev.localtube.domain.Comment;
import az.dev.localtube.repository.CommentRepository;
import az.dev.localtube.repository.VideoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CommentService {

    private final CommentRepository commentRepository;
    private final VideoRepository videoRepository;

    public Comment addComment(String videoId, String userId, String username, String text) throws IOException {
        Comment comment = new Comment();
        comment.setVideoId(videoId);
        comment.setUserId(userId);
        comment.setUsername(username);
        comment.setText(text);
        comment.setCreatedAtDateTime(LocalDateTime.now());
        comment.setLikes(0L);

        comment = commentRepository.save(comment);

        // Increment video comment count
        var video = videoRepository.findById(videoId);
        if (video.isPresent()) {
            var v = video.get();
            v.incrementCommentCount();
            videoRepository.save(v);
        }

        log.info("Comment added to video {}: {}", videoId, comment.getId());
        return comment;
    }

    public Optional<Comment> getComment(String commentId) throws IOException {
        return commentRepository.findById(commentId);
    }

    public List<Comment> getVideoComments(String videoId, int page, int size) throws IOException {
        return commentRepository.findByVideoId(videoId, page, size);
    }

    public long countVideoComments(String videoId) throws IOException {
        return commentRepository.countByVideoId(videoId);
    }

    public void deleteComment(String commentId, String videoId) throws IOException {
        commentRepository.delete(commentId);

        // Decrement video comment count
        var video = videoRepository.findById(videoId);
        if (video.isPresent()) {
            var v = video.get();
            v.decrementCommentCount();
            videoRepository.save(v);
        }

        log.info("Comment deleted: {}", commentId);
    }

    public void deleteVideoComments(String videoId) throws IOException {
        commentRepository.deleteByVideoId(videoId);
        log.info("All comments deleted for video: {}", videoId);
    }
}