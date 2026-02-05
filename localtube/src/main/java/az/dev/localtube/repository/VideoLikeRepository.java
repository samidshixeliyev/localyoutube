package az.dev.localtube.repository;

import az.dev.localtube.domain.VideoLike;
import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.Result;
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
     * Save like
     */
    public VideoLike save(VideoLike like) throws IOException {
        @SuppressWarnings("unchecked")
        Map<String, Object> document = objectMapper.convertValue(like, Map.class);

        IndexResponse response = client.index(i -> i
                .index(indexName)
                .id(like.getId())
                .document(document)
        );

        if (response.result() == Result.Created || response.result() == Result.Updated) {
            log.debug("Saved like: {}", like.getId());
            return like;
        }

        throw new IOException("Failed to save like: " + response.result());
    }

    /**
     * Find like by video and user
     */
    public Optional<VideoLike> findByVideoIdAndUserId(String videoId, Long userId) throws IOException {
        String id = VideoLike.generateId(videoId, userId);
        return findById(id);
    }

    /**
     * Find by ID
     */
    public Optional<VideoLike> findById(String id) throws IOException {
        GetResponse<VideoLike> response = client.get(g -> g
                .index(indexName)
                .id(id),
                VideoLike.class
        );

        if (response.found()) {
            return Optional.of(response.source());
        }
        return Optional.empty();
    }

    /**
     * Check if user has liked a video
     */
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
     * Delete like
     */
    public void delete(String videoId, Long userId) throws IOException {
        String id = VideoLike.generateId(videoId, userId);
        client.delete(d -> d
                .index(indexName)
                .id(id)
        );
        log.debug("Deleted like: {}", id);
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

    /**
     * Ensure index exists
     */
    private void ensureIndexExists() throws IOException {
        boolean exists = client.indices().exists(ExistsRequest.of(e -> e.index(indexName))).value();

        if (!exists) {
            client.indices().create(CreateIndexRequest.of(c -> c
                    .index(indexName)
                    .mappings(m -> m
                            .properties("id", p -> p.keyword(k -> k))
                            .properties("videoId", p -> p.keyword(k -> k))
                            .properties("userId", p -> p.long_(l -> l))
                            .properties("userEmail", p -> p.keyword(k -> k))
                            .properties("createdAt", p -> p.date(d -> d.format("strict_date_optional_time||epoch_millis")))
                    )
                    .settings(s -> s
                            .numberOfShards("1")
                            .numberOfReplicas("0")
                    )
            ));
            log.info("Created Elasticsearch index: {}", indexName);
        }
    }
}