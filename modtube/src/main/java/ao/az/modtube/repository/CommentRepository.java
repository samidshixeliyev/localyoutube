package ao.az.modtube.repository;

import ao.az.modtube.domain.Comment;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface CommentRepository extends JpaRepository<Comment, String> {

    @Query(nativeQuery = true,
           value = "SELECT c.* FROM comments c WHERE c.video_id = :videoId ORDER BY c.created_at DESC LIMIT :size OFFSET :offset")
    List<Comment> findByVideoIdPaged(@Param("videoId") String videoId,
                                     @Param("offset") int offset,
                                     @Param("size") int size);

    long countByVideoId(String videoId);

    @Modifying
    @Transactional
    @Query("DELETE FROM Comment c WHERE c.videoId = :videoId")
    void deleteByVideoId(@Param("videoId") String videoId);

    default List<Comment> findByVideoId(String videoId, int page, int size) {
        return findByVideoIdPaged(videoId, page * size, size);
    }

    default void delete(String id) {
        deleteById(id);
    }
}
