package ao.az.modtube.repository;

import ao.az.modtube.domain.Video;
import ao.az.modtube.domain.VideoStatus;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface VideoRepository extends JpaRepository<Video, String> {

    // ─── Basic ordered listing ───────────────────────────────────────────────

    @Query("SELECT v FROM Video v ORDER BY v.uploadedAt DESC NULLS LAST")
    List<Video> findAllOrdered();

    @Query(nativeQuery = true,
           value = "SELECT v.* FROM videos v ORDER BY v.uploaded_at DESC NULLS LAST LIMIT :size OFFSET :offset")
    List<Video> findAllPaged(@Param("offset") int offset, @Param("size") int size);

    List<Video> findByStatusOrderByUploadedAtDesc(VideoStatus status);

    // ─── Uploader queries ────────────────────────────────────────────────────

    @Query(nativeQuery = true,
           value = "SELECT v.* FROM videos v WHERE v.uploader_id = :uploaderId ORDER BY v.uploaded_at DESC LIMIT :size OFFSET :offset")
    List<Video> findByUploaderIdPaged(@Param("uploaderId") Long uploaderId,
                                      @Param("offset") int offset,
                                      @Param("size") int size);

    long countByUploaderId(Long uploaderId);

    // ─── Status counts ───────────────────────────────────────────────────────

    long countByStatus(VideoStatus status);

    // ─── Admin listing (all READY regardless of visibility) ─────────────────

    @Query(nativeQuery = true,
           value = "SELECT v.* FROM videos v WHERE v.status = 'READY' ORDER BY v.uploaded_at DESC LIMIT :size OFFSET :offset")
    List<Video> findAllReadyVideosPaged(@Param("offset") int offset, @Param("size") int size);

    @Query(nativeQuery = true,
           value = "SELECT COUNT(*) FROM videos v WHERE v.status = 'READY'")
    long countAllReadyVideos();

    // ─── Public / visibility-filtered listing ────────────────────────────────

    @Query(nativeQuery = true, value = """
            SELECT v.* FROM videos v
            WHERE v.status = 'READY'
              AND v.visibility = 'PUBLIC'
            ORDER BY v.uploaded_at DESC NULLS LAST
            LIMIT :size OFFSET :offset
            """)
    List<Video> findPublicVideosAnon(@Param("offset") int offset, @Param("size") int size);

    @Query(nativeQuery = true, value = """
            SELECT v.* FROM videos v
            WHERE v.status = 'READY'
              AND (v.visibility = 'PUBLIC'
                   OR v.visibility = 'UNLISTED'
                   OR (v.visibility = 'RESTRICTED'
                       AND EXISTS (
                           SELECT 1 FROM video_allowed_emails ae
                           WHERE ae.video_id = v.id AND ae.email = :userEmail
                       )))
            ORDER BY v.uploaded_at DESC NULLS LAST
            LIMIT :size OFFSET :offset
            """)
    List<Video> findPublicVideosForUser(@Param("offset") int offset,
                                        @Param("size") int size,
                                        @Param("userEmail") String userEmail);

    @Query(nativeQuery = true,
           value = "SELECT COUNT(*) FROM videos v WHERE v.status = 'READY' AND v.visibility = 'PUBLIC'")
    long countPublicVideosAnon();

    @Query(nativeQuery = true, value = """
            SELECT COUNT(*) FROM videos v
            WHERE v.status = 'READY'
              AND (v.visibility = 'PUBLIC'
                   OR v.visibility = 'UNLISTED'
                   OR (v.visibility = 'RESTRICTED'
                       AND EXISTS (
                           SELECT 1 FROM video_allowed_emails ae
                           WHERE ae.video_id = v.id AND ae.email = :userEmail
                       )))
            """)
    long countPublicVideosForUser(@Param("userEmail") String userEmail);

    // ─── Full-text + fuzzy search (pg_trgm) ──────────────────────────────────

    @Query(nativeQuery = true, value = """
            SELECT v.* FROM videos v
            WHERE v.status = 'READY'
              AND v.visibility = 'PUBLIC'
              AND (
                  v.title ILIKE '%' || :q || '%'
                  OR v.description ILIKE '%' || :q || '%'
                  OR similarity(v.title, :q) > 0.15
                  OR similarity(COALESCE(v.description, ''), :q) > 0.15
              )
            ORDER BY GREATEST(similarity(v.title, :q),
                               similarity(COALESCE(v.description, ''), :q)) DESC,
                     v.uploaded_at DESC NULLS LAST
            LIMIT :size OFFSET :offset
            """)
    List<Video> searchAnon(@Param("q") String query, @Param("offset") int offset, @Param("size") int size);

    @Query(nativeQuery = true, value = """
            SELECT v.* FROM videos v
            WHERE v.status = 'READY'
              AND (v.visibility = 'PUBLIC'
                   OR v.visibility = 'UNLISTED'
                   OR (v.visibility = 'RESTRICTED'
                       AND EXISTS (
                           SELECT 1 FROM video_allowed_emails ae
                           WHERE ae.video_id = v.id AND ae.email = :userEmail
                       )))
              AND (
                  v.title ILIKE '%' || :q || '%'
                  OR v.description ILIKE '%' || :q || '%'
                  OR similarity(v.title, :q) > 0.15
                  OR similarity(COALESCE(v.description, ''), :q) > 0.15
              )
            ORDER BY GREATEST(similarity(v.title, :q),
                               similarity(COALESCE(v.description, ''), :q)) DESC,
                     v.uploaded_at DESC NULLS LAST
            LIMIT :size OFFSET :offset
            """)
    List<Video> searchForUser(@Param("q") String query,
                              @Param("offset") int offset,
                              @Param("size") int size,
                              @Param("userEmail") String userEmail);

    // ─── Tag-based suggestions ───────────────────────────────────────────────

    // Uses a subquery instead of DISTINCT to avoid PostgreSQL's
    // "ORDER BY expressions must appear in select list" restriction.
    @Query(nativeQuery = true, value = """
            SELECT v.* FROM videos v
            WHERE v.status = 'READY'
              AND v.visibility = 'PUBLIC'
              AND v.id <> :excludeId
              AND v.id IN (
                  SELECT vt.video_id FROM video_tags vt WHERE vt.tag IN (:tags)
              )
            ORDER BY (
                SELECT COUNT(*) FROM video_tags vt2
                WHERE vt2.video_id = v.id AND vt2.tag IN (:tags)
            ) DESC
            LIMIT :size
            """)
    List<Video> findByTagsIn(@Param("tags") List<String> tags,
                             @Param("excludeId") String excludeId,
                             @Param("size") int size);

    // ─── Title suggestions ───────────────────────────────────────────────────

    @Query("SELECT v.title FROM Video v WHERE LOWER(v.title) LIKE LOWER(CONCAT('%', :query, '%')) AND v.visibility IN ('PUBLIC', 'UNLISTED') AND v.status = 'READY' ORDER BY v.views DESC")
    List<String> findTitleSuggestions(@Param("query") String query, Pageable pageable);

    // ─── Shorts ──────────────────────────────────────────────────────────────

    @Query(nativeQuery = true, value = """
            SELECT v.* FROM videos v
            WHERE v.is_short = true
              AND v.status = 'READY'
              AND v.visibility IN (:visibilities)
            ORDER BY v.views DESC NULLS LAST
            LIMIT :size OFFSET :offset
            """)
    List<Video> findShortsPaged(@Param("visibilities") List<String> visibilities,
                                @Param("offset") int offset,
                                @Param("size") int size);

    // ─── Status update ───────────────────────────────────────────────────────

    @Modifying
    @Transactional
    @Query("UPDATE Video v SET v.status = :status WHERE v.id = :id")
    void updateStatus(@Param("id") String id, @Param("status") VideoStatus status);

    // ─── Default convenience bridges (called by VideoService) ────────────────

    default List<Video> findAll(int page, int size) {
        return findAllPaged(page * size, size);
    }

    default List<Video> findByUploaderId(Long uploaderId, int page, int size) {
        return findByUploaderIdPaged(uploaderId, page * size, size);
    }

    default List<Video> findByStatus(VideoStatus status) {
        return findByStatusOrderByUploadedAtDesc(status);
    }

    default List<Video> findAllReadyVideos(int page, int size) {
        return findAllReadyVideosPaged(page * size, size);
    }

    default List<Video> findPublicVideos(int page, int size, String userEmail) {
        int offset = page * size;
        return (userEmail == null)
                ? findPublicVideosAnon(offset, size)
                : findPublicVideosForUser(offset, size, userEmail);
    }

    default long countPublicVideos(String userEmail) {
        return (userEmail == null)
                ? countPublicVideosAnon()
                : countPublicVideosForUser(userEmail);
    }

    default List<Video> search(String query, int page, int size, String userEmail) {
        int offset = page * size;
        return (userEmail == null)
                ? searchAnon(query, offset, size)
                : searchForUser(query, offset, size, userEmail);
    }

    default List<Video> findByTags(List<String> tags, String excludeVideoId, int size) {
        if (tags == null || tags.isEmpty()) return List.of();
        return findByTagsIn(tags, excludeVideoId, size);
    }

    default void delete(String id) {
        deleteById(id);
    }
}
