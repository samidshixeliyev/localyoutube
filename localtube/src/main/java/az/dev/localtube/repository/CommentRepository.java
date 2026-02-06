package az.dev.localtube.repository;

import az.dev.localtube.domain.Comment;
import az.dev.localtube.metrics.LocalTubeMetrics;
import az.dev.localtube.service.ElasticsearchIndexManager;
import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.Result;
import co.elastic.clients.elasticsearch._types.SortOrder;
import co.elastic.clients.elasticsearch._types.mapping.Property;
import co.elastic.clients.elasticsearch.core.*;
import co.elastic.clients.elasticsearch.core.search.Hit;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.util.*;

@Slf4j
@Repository
public class CommentRepository {

    private final ElasticsearchClient client;
    private final ObjectMapper objectMapper;
    private final LocalTubeMetrics metrics;
    private final ElasticsearchIndexManager indexManager;
    private final String indexName;

    public CommentRepository(
            ElasticsearchClient client,
            ObjectMapper objectMapper,
            LocalTubeMetrics metrics,
            ElasticsearchIndexManager indexManager,
            @Value("${localtube.elasticsearch.comment-index}") String indexName
    ) {
        this.client = client;
        this.objectMapper = objectMapper;
        this.metrics = metrics;
        this.indexManager = indexManager;
        this.indexName = indexName;
    }

    @PostConstruct
    public void init() {
        try {
            Map<String, Property> fields = new LinkedHashMap<>();
            fields.put("id", Property.of(p -> p.keyword(k -> k)));
            fields.put("videoId", Property.of(p -> p.keyword(k -> k)));
            fields.put("userId", Property.of(p -> p.keyword(k -> k)));
            fields.put("username", Property.of(p -> p.text(t -> t)));
            fields.put("text", Property.of(p -> p.text(t -> t.analyzer("standard"))));
            fields.put("likes", Property.of(p -> p.long_(l -> l)));
            fields.put("createdAt", Property.of(p -> p.date(d -> d.format("strict_date_optional_time||epoch_millis"))));
            fields.put("updatedAt", Property.of(p -> p.date(d -> d.format("strict_date_optional_time||epoch_millis"))));

            indexManager.ensureIndexMapping(indexName, fields);
        } catch (IOException e) {
            log.error("Failed to initialize comment index", e);
        }
    }

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

    public long countByVideoId(String videoId) throws IOException {
        CountResponse response = client.count(c -> c
                .index(indexName)
                .query(q -> q.term(t -> t.field("videoId").value(videoId)))
        );
        return response.count();
    }

    public void delete(String id) throws IOException {
        client.delete(d -> d
                .index(indexName)
                .id(id)
        );
        log.info("Deleted comment: {}", id);
    }

    public void deleteByVideoId(String videoId) throws IOException {
        client.deleteByQuery(d -> d
                .index(indexName)
                .query(q -> q.term(t -> t.field("videoId").value(videoId)))
        );
        log.info("Deleted all comments for video: {}", videoId);
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