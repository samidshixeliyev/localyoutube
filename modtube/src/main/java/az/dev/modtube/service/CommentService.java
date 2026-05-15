package az.dev.modtube.service;

import az.dev.modtube.domain.Comment;
import az.dev.modtube.repository.CommentRepository;
import az.dev.modtube.repository.VideoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CommentService {

    private final CommentRepository commentRepository;
    private final VideoRepository videoRepository;

    @Transactional
    public Comment addComment(String videoId, String userEmail, String username, String text) {
        Comment comment = new Comment();
        comment.setId(UUID.randomUUID().toString().replace("-", ""));
        comment.setVideoId(videoId);
        comment.setUserId(userEmail);
        comment.setUsername(username);
        comment.setText(text);
        comment.setCreatedAtDateTime(LocalDateTime.now());
        comment.setLikes(0L);

        comment = commentRepository.save(comment);

        videoRepository.findById(videoId).ifPresent(v -> {
            v.incrementCommentCount();
            videoRepository.save(v);
        });

        log.info("Comment added to video {} by {}: {}", videoId, userEmail, comment.getId());
        return comment;
    }

    public Optional<Comment> getComment(String commentId) {
        return commentRepository.findById(commentId);
    }

    public List<Comment> getVideoComments(String videoId, int page, int size) {
        return commentRepository.findByVideoId(videoId, page, size);
    }

    public long countVideoComments(String videoId) {
        return commentRepository.countByVideoId(videoId);
    }

    @Transactional
    public void deleteComment(String commentId, String videoId) {
        commentRepository.deleteById(commentId);

        videoRepository.findById(videoId).ifPresent(v -> {
            v.decrementCommentCount();
            videoRepository.save(v);
        });

        log.info("Comment deleted: {}", commentId);
    }

    @Transactional
    public void deleteVideoComments(String videoId) {
        commentRepository.deleteByVideoId(videoId);
        log.info("All comments deleted for video: {}", videoId);
    }
}
