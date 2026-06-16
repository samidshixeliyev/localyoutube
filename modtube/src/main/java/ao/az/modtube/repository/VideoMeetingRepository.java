package ao.az.modtube.repository;

import ao.az.modtube.domain.VideoMeeting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VideoMeetingRepository extends JpaRepository<VideoMeeting, Long> {
    Optional<VideoMeeting> findByRoomCode(String roomCode);
    List<VideoMeeting> findAllByOrderByCreatedAtDesc();
    List<VideoMeeting> findByHostEmailOrderByCreatedAtDesc(String hostEmail);
}
