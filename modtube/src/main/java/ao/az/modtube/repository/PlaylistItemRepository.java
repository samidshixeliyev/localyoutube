package ao.az.modtube.repository;

import ao.az.modtube.domain.PlaylistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface PlaylistItemRepository extends JpaRepository<PlaylistItem, Long> {
    List<PlaylistItem> findByPlaylistIdOrderByPositionAsc(String playlistId);
    Optional<PlaylistItem> findByPlaylistIdAndVideoId(String playlistId, String videoId);
    boolean existsByPlaylistIdAndVideoId(String playlistId, String videoId);

    @Modifying @Transactional
    void deleteByPlaylistIdAndVideoId(String playlistId, String videoId);

    @Query("SELECT MAX(pi.position) FROM PlaylistItem pi WHERE pi.playlistId = :playlistId")
    Optional<Integer> findMaxPositionByPlaylistId(String playlistId);

    long countByPlaylistId(String playlistId);
}
