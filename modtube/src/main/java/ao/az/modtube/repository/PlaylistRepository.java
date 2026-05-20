package ao.az.modtube.repository;

import ao.az.modtube.domain.Playlist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PlaylistRepository extends JpaRepository<Playlist, String> {
    List<Playlist> findByOwnerEmailOrderByCreatedAtDesc(String ownerEmail);
}
