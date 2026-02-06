package az.dev.localtube.repository;

import az.dev.localtube.domain.VideoLike;
import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.Result;
import co.elastic.clients.elasticsearch._types.Time;
import co.elastic.clients.elasticsearch.core.*;
import co.elastic.clients.elasticsearch.indices.CreateIndexRequest;
import co.elastic.clients.elasticsearch.indices.ExistsRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.util.Map;
import java.util.Optional;

/**
 * VideoLike repository - tracks which users liked which videos
 * FIXED: Proper unique constraint using deterministic IDs
 */
@Slf4j
@Repository
public class VideoLikeRepository {

    private final ElasticsearchClient client;
    private final ObjectMapper objectMapper;
    private final String indexName;

    public VideoLikeRepository(
            ElasticsearchClient client,
            ObjectMapper objectMapper,
            @Value("${localtube.elasticsearch.like-index}") String indexName
    ) {
        this.client = client;
        this.objectMapper = objectMapper;
        this.indexName = indexName;
    }

    @PostConstruct
    public void init() {
        try {
            ensureIndexExists();
        } catch (IOException e) {
            log.error("Failed to initialize likes index", e);
        }
    }

    /**
     * Save like - uses deterministic ID to prevent duplicates
     */
    public VideoLike save(VideoLike like) throws IOException {
        // Ensure ID is set
        if (like.getId() == null) {
            if (like.getVideoId() != null && like.getUserEmail() != null) {
                like.setId(VideoLike.generateId(like.getVideoId(), like.getUserEmail()));
            } else {
                throw new IllegalArgumentException("Cannot generate like ID: videoId or userEmail is null");
            }
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> document = objectMapper.convertValue(like, Map.class);

        log.debug("Saving like with ID: {}", like.getId());

        IndexResponse response = client.index(i -> i
                .index(indexName)
                .id(like.getId())
                .document(document)
                .opType(co.elastic.clients.elasticsearch._types.OpType.Index) // Will overwrite if exists
        );

        if (response.result() == Result.Created || response.result() == Result.Updated) {
            log.debug("Saved like: {} (result: {})", like.getId(), response.result());
            return like;
        }

        throw new IOException("Failed to save like: " + response.result());
    }

    /**
     * Find like by video and user email
     */
    public Optional<VideoLike> findByVideoIdAndUserEmail(String videoId, String userEmail) throws IOException {
        String id = VideoLike.generateId(videoId, userEmail);
        log.debug("Looking for like with ID: {}", id);
        return findById(id);
    }

    /**
     * Find by ID
     */
    public Optional<VideoLike> findById(String id) throws IOException {
        try {
            GetResponse<VideoLike> response = client.get(g -> g
                            .index(indexName)
                            .id(id),
                    VideoLike.class
            );

            if (response.found()) {
                log.debug("Found like: {}", id);
                return Optional.of(response.source());
            }
            log.debug("Like not found: {}", id);
            return Optional.empty();
        } catch (Exception e) {
            log.error("Error finding like by ID {}: {}", id, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Check if user has liked a video (by email)
     */
    public boolean existsByVideoIdAndUserEmail(String videoId, String userEmail) throws IOException {
        String id = VideoLike.generateId(videoId, userEmail);
        log.debug("Checking if like exists: {}", id);

        try {
            GetResponse<VideoLike> response = client.get(g -> g
                            .index(indexName)
                            .id(id),
                    VideoLike.class
            );

            boolean exists = response.found();
            log.debug("Like {} exists: {}", id, exists);
            return exists;
        } catch (Exception e) {
            log.error("Error checking if like exists {}: {}", id, e.getMessage());
            return false;
        }
    }

    /**
     * Delete like by email
     */
    public void deleteByEmail(String videoId, String userEmail) throws IOException {
        String id = VideoLike.generateId(videoId, userEmail);
        log.info("Deleting like: {}", id);

        try {
            client.delete(d -> d
                    .index(indexName)
                    .id(id)
            );
            log.info("Deleted like: {}", id);
        } catch (Exception e) {
            log.error("Error deleting like {}: {}", id, e.getMessage());
            throw new IOException("Failed to delete like", e);
        }
    }

    /**
     * Delete all likes for a video
     */
    public void deleteByVideoId(String videoId) throws IOException {
        client.deleteByQuery(d -> d
                .index(indexName)
                .query(q -> q.term(t -> t.field("videoId").value(videoId)))
        );
        log.info("Deleted all likes for video: {}", videoId);
    }

    /**
     * Count likes for a video
     */
    public long countByVideoId(String videoId) throws IOException {
        CountResponse response = client.count(c -> c
                .index(indexName)
                .query(q -> q.term(t -> t.field("videoId").value(videoId)))
        );
        return response.count();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LEGACY METHODS - Kept for backward compatibility during migration
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @deprecated Use findByVideoIdAndUserEmail instead
     */
    @Deprecated
    public Optional<VideoLike> findByVideoIdAndUserId(String videoId, Long userId) throws IOException {
        String id = VideoLike.generateId(videoId, userId);
        return findById(id);
    }

    /**
     * @deprecated Use existsByVideoIdAndUserEmail instead
     */
    @Deprecated
    public boolean existsByVideoIdAndUserId(String videoId, Long userId) throws IOException {
        String id = VideoLike.generateId(videoId, userId);
        GetResponse<VideoLike> response = client.get(g -> g
                        .index(indexName)
                        .id(id),
                VideoLike.class
        );
        return response.found();
    }

    /**
     * @deprecated Use deleteByEmail instead
     */
    @Deprecated
    public void delete(String videoId, Long userId) throws IOException {
        String id = VideoLike.generateId(videoId, userId);
        client.delete(d -> d
                .index(indexName)
                .id(id)
        );
        log.debug("Deleted like: {}", id);
    }

    /**
     * Ensure index exists with proper mapping
     */
    private void ensureIndexExists() throws IOException {
        boolean exists = client.indices().exists(ExistsRequest.of(e -> e.index(indexName))).value();

        if (!exists) {
            client.indices().create(CreateIndexRequest.of(c -> c
                    .index(indexName)
                    .mappings(m -> m
                            .properties("id", p -> p.keyword(k -> k))
                            .properties("videoId", p -> p.keyword(k -> k))
                            .properties("userId", p -> p.long_(l -> l))  // Legacy field
                            .properties("userEmail", p -> p.keyword(k -> k))  // PRIMARY field
                            .properties("createdAt", p -> p.date(d -> d.format("strict_date_optional_time||epoch_millis")))
                    )
                    .settings(s -> s
                            .numberOfShards("1")
                            .numberOfReplicas("0")
                            .refreshInterval(Time.of(t -> t.time("1s")))  // Refresh every second
                    )
            ));
            log.info("Created Elasticsearch index: {} with refresh_interval=1s", indexName);
        }
    }
}