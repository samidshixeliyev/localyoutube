package az.dev.localtube.repository;

import az.dev.localtube.domain.Comment;
import az.dev.localtube.metrics.LocalTubeMetrics;
import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.Result;
import co.elastic.clients.elasticsearch._types.SortOrder;
import co.elastic.clients.elasticsearch.core.*;
import co.elastic.clients.elasticsearch.core.search.Hit;
import co.elastic.clients.elasticsearch.indices.CreateIndexRequest;
import co.elastic.clients.elasticsearch.indices.ExistsRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.util.*;

/**
 * Comment repository using Elasticsearch
 */
@Slf4j
@Repository
public class CommentRepository {

    private final ElasticsearchClient client;
    private final ObjectMapper objectMapper;
    private final LocalTubeMetrics metrics;
    private final String indexName;

    public CommentRepository(
            ElasticsearchClient client,
            ObjectMapper objectMapper,
            LocalTubeMetrics metrics,
            @Value("${localtube.elasticsearch.comment-index}") String indexName
    ) {
        this.client = client;
        this.objectMapper = objectMapper;
        this.metrics = metrics;
        this.indexName = indexName;
    }

    @PostConstruct
    public void init() {
        try {
            ensureIndexExists();
        } catch (IOException e) {
            log.error("Failed to initialize comment index", e);
        }
    }

    /**
     * Save comment
     */
    public Comment save(Comment comment) throws IOException {
        if (comment.getId() == null) {
            comment.setId(generateId());
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> document = objectMapper.convertValue(comment, Map.class);

        IndexResponse response = client.index(i -> i
                .index(indexName)
                .id(comment.getId())
                .document(document)
        );

        if (response.result() == Result.Created || response.result() == Result.Updated) {
            log.debug("Saved comment: {}", comment.getId());
            return comment;
        }

        throw new IOException("Failed to save comment: " + response.result());
    }

    /**
     * Find comment by ID
     */
    public Optional<Comment> findById(String id) throws IOException {
        GetResponse<Comment> response = client.get(g -> g
                .index(indexName)
                .id(id),
                Comment.class
        );

        if (response.found()) {
            return Optional.of(response.source());
        }
        return Optional.empty();
    }

    /**
     * Find comments by video ID with pagination
     */
    public List<Comment> findByVideoId(String videoId, int page, int size) throws IOException {
        SearchResponse<Comment> response = client.search(s -> s
                .index(indexName)
                .from(page * size)
                .size(size)
                .query(q -> q
                        .term(t -> t.field("videoId").value(videoId))
                )
                .sort(so -> so.field(f -> f.field("createdAt").order(SortOrder.Desc))),
                Comment.class
        );

        return extractHits(response);
    }

    /**
     * Count comments for a video
     */
    public long countByVideoId(String videoId) throws IOException {
        CountResponse response = client.count(c -> c
                .index(indexName)
                .query(q -> q.term(t -> t.field("videoId").value(videoId)))
        );
        return response.count();
    }

    /**
     * Delete comment
     */
    public void delete(String id) throws IOException {
        client.delete(d -> d
                .index(indexName)
                .id(id)
        );
        log.info("Deleted comment: {}", id);
    }

    /**
     * Delete all comments for a video
     */
    public void deleteByVideoId(String videoId) throws IOException {
        client.deleteByQuery(d -> d
                .index(indexName)
                .query(q -> q.term(t -> t.field("videoId").value(videoId)))
        );
        log.info("Deleted all comments for video: {}", videoId);
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
                            .properties("username", p -> p.text(t -> t))
                            .properties("text", p -> p.text(t -> t.analyzer("standard")))
                            .properties("likes", p -> p.long_(l -> l))
                            .properties("createdAt", p -> p.date(d -> d.format("strict_date_optional_time||epoch_millis")))
                            .properties("updatedAt", p -> p.date(d -> d.format("strict_date_optional_time||epoch_millis")))
                    )
                    .settings(s -> s
                            .numberOfShards("1")
                            .numberOfReplicas("0")
                    )
            ));
            log.info("Created Elasticsearch index: {}", indexName);
        }
    }

    private List<Comment> extractHits(SearchResponse<Comment> response) {
        List<Comment> comments = new ArrayList<>();
        for (Hit<Comment> hit : response.hits().hits()) {
            if (hit.source() != null) {
                comments.add(hit.source());
            }
        }
        return comments;
    }

    private String generateId() {
        return UUID.randomUUID().toString().replace("-", "");
    }
}