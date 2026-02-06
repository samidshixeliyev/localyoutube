package az.dev.localtube.repository;

import az.dev.localtube.domain.VideoLike;
import az.dev.localtube.service.ElasticsearchIndexManager;
import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.Result;
import co.elastic.clients.elasticsearch._types.mapping.Property;
import co.elastic.clients.elasticsearch.core.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Repository
public class VideoLikeRepository {

    private final ElasticsearchClient client;
    private final ObjectMapper objectMapper;
    private final ElasticsearchIndexManager indexManager;
    private final String indexName;

    public VideoLikeRepository(
            ElasticsearchClient client,
            ObjectMapper objectMapper,
            ElasticsearchIndexManager indexManager,
            @Value("${localtube.elasticsearch.like-index}") String indexName
    ) {
        this.client = client;
        this.objectMapper = objectMapper;
        this.indexManager = indexManager;
        this.indexName = indexName;
    }

    @PostConstruct
    public void init() {
        try {
            Map<String, Property> fields = new LinkedHashMap<>();
            fields.put("id", Property.of(p -> p.keyword(k -> k)));
            fields.put("videoId", Property.of(p -> p.keyword(k -> k)));
            fields.put("userId", Property.of(p -> p.long_(l -> l)));
            fields.put("userEmail", Property.of(p -> p.keyword(k -> k)));
            fields.put("createdAt", Property.of(p -> p.date(d -> d.format("strict_date_optional_time||epoch_millis"))));

            indexManager.ensureIndexMapping(indexName, fields);
        } catch (IOException e) {
            log.error("Failed to initialize likes index", e);
        }
    }

    public VideoLike save(VideoLike like) throws IOException {
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
                .opType(co.elastic.clients.elasticsearch._types.OpType.Index)
        );

        if (response.result() == Result.Created || response.result() == Result.Updated) {
            log.debug("Saved like: {} (result: {})", like.getId(), response.result());
            return like;
        }

        throw new IOException("Failed to save like: " + response.result());
    }

    public Optional<VideoLike> findByVideoIdAndUserEmail(String videoId, String userEmail) throws IOException {
        String id = VideoLike.generateId(videoId, userEmail);
        log.debug("Looking for like with ID: {}", id);
        return findById(id);
    }

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

    public void deleteByVideoId(String videoId) throws IOException {
        client.deleteByQuery(d -> d
                .index(indexName)
                .query(q -> q.term(t -> t.field("videoId").value(videoId)))
        );
        log.info("Deleted all likes for video: {}", videoId);
    }

    public long countByVideoId(String videoId) throws IOException {
        CountResponse response = client.count(c -> c
                .index(indexName)
                .query(q -> q.term(t -> t.field("videoId").value(videoId)))
        );
        return response.count();
    }
}