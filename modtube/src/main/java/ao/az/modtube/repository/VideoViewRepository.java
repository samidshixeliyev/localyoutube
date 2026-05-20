package ao.az.modtube.repository;

import ao.az.modtube.domain.VideoView;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface VideoViewRepository extends JpaRepository<VideoView, Long> {

    @Query(value = """
        SELECT vv.video_id, v.title, v.uploader_name, COUNT(*) AS view_count,
               MAX(vv.viewed_at) AS last_viewed
        FROM video_views vv
        JOIN videos v ON v.id = vv.video_id
        WHERE vv.viewed_at >= :since
        GROUP BY vv.video_id, v.title, v.uploader_name
        ORDER BY view_count DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Object[]> findTopVideos(@Param("since") Instant since, @Param("limit") int limit);

    @Query(value = """
        SELECT vv.user_email, vv.user_id, COUNT(*) AS view_count,
               COUNT(DISTINCT vv.video_id) AS unique_videos,
               MAX(vv.viewed_at) AS last_viewed
        FROM video_views vv
        WHERE vv.user_email IS NOT NULL
          AND vv.viewed_at >= :since
        GROUP BY vv.user_email, vv.user_id
        ORDER BY view_count DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Object[]> findTopUsers(@Param("since") Instant since, @Param("limit") int limit);

    @Query(value = """
        SELECT DATE(viewed_at) AS day, COUNT(*) AS view_count
        FROM video_views
        WHERE viewed_at >= :since
        GROUP BY DATE(viewed_at)
        ORDER BY day
        """, nativeQuery = true)
    List<Object[]> findDailyViews(@Param("since") Instant since);

    @Query(value = """
        SELECT EXTRACT(HOUR FROM viewed_at) AS hour, COUNT(*) AS view_count
        FROM video_views
        WHERE viewed_at >= :since
        GROUP BY EXTRACT(HOUR FROM viewed_at)
        ORDER BY hour
        """, nativeQuery = true)
    List<Object[]> findHourlyDistribution(@Param("since") Instant since);

    @Query(value = """
        SELECT COUNT(*) FROM video_views WHERE viewed_at >= :since
        """, nativeQuery = true)
    long countSince(@Param("since") Instant since);

    @Query(value = """
        SELECT COUNT(DISTINCT user_email) FROM video_views
        WHERE user_email IS NOT NULL AND viewed_at >= :since
        """, nativeQuery = true)
    long countActiveUsers(@Param("since") Instant since);

    @Query(value = """
        SELECT COUNT(DISTINCT video_id) FROM video_views WHERE viewed_at >= :since
        """, nativeQuery = true)
    long countWatchedVideos(@Param("since") Instant since);

    @Query(value = """
        SELECT EXTRACT(DOW FROM viewed_at) AS dow, COUNT(*) AS view_count
        FROM video_views
        WHERE viewed_at >= :since
        GROUP BY EXTRACT(DOW FROM viewed_at)
        ORDER BY dow
        """, nativeQuery = true)
    List<Object[]> findWeekdayDistribution(@Param("since") Instant since);
}
