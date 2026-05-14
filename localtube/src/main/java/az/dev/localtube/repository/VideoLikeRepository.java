package az.dev.localtube.repository;

import az.dev.localtube.domain.VideoLike;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Repository
public interface VideoLikeRepository extends JpaRepository<VideoLike, String> {

    boolean existsByVideoIdAndUserEmail(String videoId, String userEmail);

    Optional<VideoLike> findByVideoIdAndUserEmail(String videoId, String userEmail);

    @Modifying
    @Transactional
    @Query("DELETE FROM VideoLike vl WHERE vl.videoId = :videoId AND vl.userEmail = :userEmail")
    void deleteByEmail(@Param("videoId") String videoId, @Param("userEmail") String userEmail);

    @Modifying
    @Transactional
    @Query("DELETE FROM VideoLike vl WHERE vl.videoId = :videoId")
    void deleteByVideoId(@Param("videoId") String videoId);

    long countByVideoId(String videoId);
}
