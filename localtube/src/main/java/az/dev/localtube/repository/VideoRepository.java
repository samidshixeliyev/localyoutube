package az.dev.localtube.repository;

import az.dev.localtube.domain.Video;
import az.dev.localtube.domain.VideoStatus;
import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.Result;
import co.elastic.clients.elasticsearch._types.SortOrder;
import co.elastic.clients.elasticsearch.core.*;
import co.elastic.clients.elasticsearch.core.search.Hit;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.temporal.TemporalField;
import java.util.*;

@Slf4j
@Repository
public class VideoRepository {

    private final ElasticsearchClient client;
    private final String indexName;
    private final ObjectMapper objectMapper;

    public VideoRepository(ElasticsearchClient client,
                           @Qualifier("elasticsearchObjectMapper") ObjectMapper objectMapper,
                           @Value("${localtube.elasticsearch.video-index}") String indexName) {
        this.client = client;
        this.indexName = indexName;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void init() {
        try {
            ensureIndex();
        } catch (IOException e) {
            log.error("Failed to initialize video index", e);
        }
    }

    public Video save(Video video) throws IOException {
        if (video.getId() == null) {
            video.setId(UUID.randomUUID().toString().replace("-", ""));
        }

        if (video.getUpdatedAt() == null) {
            video.setUpdatedAt(new Date().getTime());
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> document = objectMapper.convertValue(video, Map.class);

        IndexResponse response = client.index(i -> i
                .index(indexName)
                .id(video.getId())
                .document(document)
        );

        if (response.result() == Result.Created || response.result() == Result.Updated) {
            log.debug("Saved video: {}", video.getId());
            return video;
        }

        throw new IOException("Failed to save video: " + response.result());
    }

    public Optional<Video> findById(String id) throws IOException {
        try {
            GetResponse<ObjectNode> response = client.get(g -> g
                    .index(indexName)
                    .id(id), ObjectNode.class);

            if (response.found() && response.source() != null) {
                Video video = objectMapper.treeToValue(response.source(), Video.class);
                return Optional.of(video);
            }
            return Optional.empty();
        } catch (Exception e) {
            log.error("Error finding video {}: {}", id, e.getMessage());
            return Optional.empty();
        }
    }

    public List<Video> findAll() throws IOException {
        return findAll(0, 1000);
    }

    public List<Video> findAll(int page, int size) throws IOException {
        SearchResponse<ObjectNode> response = client.search(s -> s
                .index(indexName)
                .from(page * size)
                .size(size)
                .sort(so -> so.field(f -> f.field("uploadedAt").order(SortOrder.Desc)))
                .query(q -> q.matchAll(m -> m)), ObjectNode.class);

        return extractVideos(response);
    }

    public List<Video> findByStatus(VideoStatus status) throws IOException {
        SearchResponse<ObjectNode> response = client.search(s -> s
                .index(indexName)
                .size(1000)
                .query(q -> q.term(t -> t.field("status").value(status.name()))), ObjectNode.class);

        return extractVideos(response);
    }

    public List<Video> findByStatusWithPagination(VideoStatus status, int page, int size) throws IOException {
        SearchResponse<ObjectNode> response = client.search(s -> s
                .index(indexName)
                .from(page * size)
                .size(size)
                .sort(so -> so.field(f -> f.field("uploadedAt").order(SortOrder.Desc)))
                .query(q -> q.term(t -> t.field("status").value(status.name()))), ObjectNode.class);

        return extractVideos(response);
    }

    public List<Video> findByUploaderId(Long uploaderId, int page, int size) throws IOException {
        SearchResponse<ObjectNode> response = client.search(s -> s
                .index(indexName)
                .from(page * size)
                .size(size)
                .sort(so -> so.field(f -> f.field("uploadedAt").order(SortOrder.Desc)))
                .query(q -> q.term(t -> t.field("uploaderId").value(uploaderId))), ObjectNode.class);

        return extractVideos(response);
    }

    public long countByStatus(VideoStatus status) throws IOException {
        CountResponse response = client.count(c -> c
                .index(indexName)
                .query(q -> q.term(t -> t.field("status").value(status.name()))));
        return response.count();
    }

    public long countByUploaderId(Long uploaderId) throws IOException {
        CountResponse response = client.count(c -> c
                .index(indexName)
                .query(q -> q.term(t -> t.field("uploaderId").value(uploaderId))));
        return response.count();
    }

    public List<Video> search(String query) throws IOException {
        return search(query, 0, 20);
    }

    public List<Video> search(String query, int page, int size) throws IOException {
        SearchResponse<ObjectNode> response = client.search(s -> s
                .index(indexName)
                .from(page * size)
                .size(size)
                .query(q -> q.bool(b -> b
                        .must(m -> m.multiMatch(mm -> mm.query(query).fields("title^2", "description", "tags")))
                        .filter(f -> f.term(t -> t.field("status").value(VideoStatus.READY.name())))
                )), ObjectNode.class);

        return extractVideos(response);
    }

    public void updateStatus(String id, VideoStatus status) throws IOException {
        // Use upsert to handle the case where document doesn't exist yet
        try {
            Optional<Video> videoOpt = findById(id);
            if (videoOpt.isPresent()) {
                Video video = videoOpt.get();
                video.setStatus(status);
                video.setUpdatedAt(new Date().getTime());
                save(video);
            } else {
                log.warn("Video not found for status update: {}", id);
            }
        } catch (Exception e) {
            log.error("Failed to update status for video {}: {}", id, e.getMessage(), e);
            throw new IOException("Failed to update video status", e);
        }
    }

    public void delete(String id) throws IOException {
        client.delete(d -> d.index(indexName).id(id));
        log.info("Deleted video: {}", id);
    }

    private List<Video> extractVideos(SearchResponse<ObjectNode> response) {
        List<Video> videos = new ArrayList<>();
        for (Hit<ObjectNode> hit : response.hits().hits()) {
            if (hit.source() != null) {
                try {
                    videos.add(objectMapper.treeToValue(hit.source(), Video.class));
                } catch (Exception e) {
                    log.error("Error parsing video: {}", e.getMessage());
                }
            }
        }
        return videos;
    }

    private void ensureIndex() throws IOException {
        boolean exists = client.indices().exists(e -> e.index(indexName)).value();

        if (!exists) {
            client.indices().create(c -> c
                    .index(indexName)
                    .mappings(m -> m
                            .properties("id", p -> p.keyword(k -> k))
                            .properties("title", p -> p.text(t -> t.analyzer("standard").fields("keyword", f -> f.keyword(kw -> kw))))
                            .properties("description", p -> p.text(t -> t.analyzer("standard")))
                            .properties("filename", p -> p.keyword(k -> k))
                            .properties("uploaderId", p -> p.long_(l -> l))
                            .properties("uploaderName", p -> p.keyword(k -> k))
                            .properties("uploaderEmail", p -> p.keyword(k -> k))
                            .properties("status", p -> p.keyword(k -> k))
                            .properties("tags", p -> p.keyword(k -> k))
                            .properties("availableQualities", p -> p.keyword(k -> k))
                            .properties("uploadedAt", p -> p.date(d -> d))
                            .properties("processedAt", p -> p.date(d -> d))
                            .properties("updatedAt", p -> p.date(d -> d))
                            .properties("views", p -> p.long_(l -> l))
                            .properties("likes", p -> p.long_(l -> l))
                            .properties("commentCount", p -> p.integer(i -> i))
                            .properties("width", p -> p.integer(i -> i))
                            .properties("height", p -> p.integer(i -> i))
                            .properties("durationSeconds", p -> p.integer(i -> i))
                            .properties("fileSize", p -> p.long_(l -> l))
                    )
            );
            log.info("Created Elasticsearch index: {}", indexName);
        }
    }
}