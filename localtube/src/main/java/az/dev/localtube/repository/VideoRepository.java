package az.dev.localtube.repository;

import az.dev.localtube.domain.Video;
import az.dev.localtube.domain.VideoStatus;
import az.dev.localtube.domain.VideoVisibility;
import az.dev.localtube.service.ElasticsearchIndexManager;
import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.FieldValue;
import co.elastic.clients.elasticsearch._types.Result;
import co.elastic.clients.elasticsearch._types.SortOrder;
import co.elastic.clients.elasticsearch._types.mapping.Property;
import co.elastic.clients.elasticsearch._types.query_dsl.Operator;
import co.elastic.clients.elasticsearch._types.query_dsl.TextQueryType;
import co.elastic.clients.elasticsearch.core.CountResponse;
import co.elastic.clients.elasticsearch.core.GetResponse;
import co.elastic.clients.elasticsearch.core.IndexResponse;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.search.Hit;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Repository
public class VideoRepository {

    private final ElasticsearchClient client;
    private final String indexName;
    private final ObjectMapper objectMapper;
    private final ElasticsearchIndexManager indexManager;

    public VideoRepository(ElasticsearchClient client,
                           @Qualifier("elasticsearchObjectMapper") ObjectMapper objectMapper,
                           @Value("${localtube.elasticsearch.video-index}") String indexName,
                           ElasticsearchIndexManager indexManager) {
        this.client = client;
        this.indexName = indexName;
        this.objectMapper = objectMapper;
        this.indexManager = indexManager;
    }

    @PostConstruct
    public void init() {
        try {
            Map<String, Property> fields = new LinkedHashMap<>();
            fields.put("id", Property.of(p -> p.keyword(k -> k)));
            fields.put("title", Property.of(p -> p.text(t -> t.analyzer("standard")
                    .fields("keyword", f -> f.keyword(kw -> kw)))));
            fields.put("description", Property.of(p -> p.text(t -> t.analyzer("standard"))));
            fields.put("filename", Property.of(p -> p.keyword(k -> k)));
            fields.put("originalFilename", Property.of(p -> p.keyword(k -> k)));
            fields.put("uploaderId", Property.of(p -> p.long_(l -> l)));
            fields.put("uploaderName", Property.of(p -> p.keyword(k -> k)));
            fields.put("uploaderEmail", Property.of(p -> p.keyword(k -> k)));
            fields.put("uploadPath", Property.of(p -> p.keyword(k -> k)));
            fields.put("hlsPath", Property.of(p -> p.keyword(k -> k)));
            fields.put("masterPlaylistUrl", Property.of(p -> p.keyword(k -> k)));
            fields.put("thumbnailPath", Property.of(p -> p.keyword(k -> k)));
            fields.put("thumbnailUrl", Property.of(p -> p.keyword(k -> k)));
            fields.put("status", Property.of(p -> p.keyword(k -> k)));
            fields.put("visibility", Property.of(p -> p.keyword(k -> k)));
            fields.put("allowedEmails", Property.of(p -> p.keyword(k -> k)));
            fields.put("restrictionNote", Property.of(p -> p.text(t -> t)));
            fields.put("tags", Property.of(p -> p.keyword(k -> k)));
            fields.put("availableQualities", Property.of(p -> p.keyword(k -> k)));
            fields.put("processingProgress", Property.of(p -> p.integer(i -> i)));
            fields.put("processingError", Property.of(p -> p.text(t -> t)));
            fields.put("fileSize", Property.of(p -> p.long_(l -> l)));
            fields.put("durationSeconds", Property.of(p -> p.integer(i -> i)));
            fields.put("width", Property.of(p -> p.integer(i -> i)));
            fields.put("height", Property.of(p -> p.integer(i -> i)));
            fields.put("codec", Property.of(p -> p.keyword(k -> k)));
            fields.put("frameRate", Property.of(p -> p.double_(d -> d)));
            fields.put("views", Property.of(p -> p.long_(l -> l)));
            fields.put("likes", Property.of(p -> p.long_(l -> l)));
            fields.put("commentCount", Property.of(p -> p.integer(i -> i)));
            fields.put("uploadedAt", Property.of(p -> p.date(d -> d)));
            fields.put("processedAt", Property.of(p -> p.date(d -> d)));
            fields.put("updatedAt", Property.of(p -> p.date(d -> d)));

            indexManager.ensureIndexMapping(indexName, fields);
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

    // ═══════════════════════════════════════════════════════════════
    // SEARCH
    // ═══════════════════════════════════════════════════════════════

    public List<Video> search(String query) throws IOException {
        return search(query, 0, 20, null);
    }

    public List<Video> search(String query, int page, int size) throws IOException {
        return search(query, page, size, null);
    }

    public List<Video> search(String query, int page, int size, String userEmail) throws IOException {
        SearchResponse<ObjectNode> response = client.search(s -> s
                        .index(indexName)
                        .from(page * size)
                        .size(size)
                        .query(q -> q.bool(b -> {
                            var boolQuery = b
                                    .must(m -> m.multiMatch(mm -> mm
                                            .query(query)
                                            .fields("title^2", "description", "tags^1.5")
                                            .type(TextQueryType.BestFields)
                                            .operator(Operator.Or)
                                            .fuzziness("AUTO")
                                            .prefixLength(0)
                                            .maxExpansions(50)
                                            .minimumShouldMatch("50%")
                                            .fuzzyTranspositions(true)
                                    ))
                                    .filter(f -> f.term(t -> t
                                            .field("status")
                                            .value(VideoStatus.READY.name())
                                    ));

                            addVisibilityFilter(boolQuery, userEmail);
                            return boolQuery;
                        })),
                ObjectNode.class
        );

        return extractVideos(response);
    }

    // ═══════════════════════════════════════════════════════════════
    // TAG-BASED SUGGESTIONS
    // ═══════════════════════════════════════════════════════════════

    public List<Video> findByTags(List<String> tags, String excludeVideoId, int size) throws IOException {
        if (tags == null || tags.isEmpty()) {
            return List.of();
        }

        List<FieldValue> tagValues = tags.stream()
                .map(FieldValue::of)
                .collect(Collectors.toList());

        SearchResponse<ObjectNode> response = client.search(s -> s
                        .index(indexName)
                        .size(size)
                        .query(q -> q.bool(b -> b
                                .must(m -> m.terms(t -> t
                                        .field("tags")
                                        .terms(tv -> tv.value(tagValues))
                                ))
                                .must(m -> m.term(t -> t
                                        .field("status")
                                        .value(VideoStatus.READY.name())
                                ))
                                .filter(f -> f.term(t -> t
                                        .field("visibility")
                                        .value(VideoVisibility.PUBLIC.name())
                                ))
                                .mustNot(mn -> mn.term(t -> t
                                        .field("id")
                                        .value(excludeVideoId)
                                ))
                        )),
                ObjectNode.class
        );

        return extractVideos(response);
    }

    // ═══════════════════════════════════════════════════════════════
    // ADMIN LISTING (all videos regardless of visibility)
    // ═══════════════════════════════════════════════════════════════

    public List<Video> findAllReadyVideos(int page, int size) throws IOException {
        SearchResponse<ObjectNode> response = client.search(s -> s
                .index(indexName)
                .from(page * size)
                .size(size)
                .sort(so -> so.field(f -> f.field("uploadedAt").order(SortOrder.Desc)))
                .query(q -> q.term(t -> t.field("status").value(VideoStatus.READY.name()))),
                ObjectNode.class);

        return extractVideos(response);
    }

    public long countAllReadyVideos() throws IOException {
        CountResponse response = client.count(c -> c
                .index(indexName)
                .query(q -> q.term(t -> t.field("status").value(VideoStatus.READY.name()))));
        return response.count();
    }

    // ═══════════════════════════════════════════════════════════════
    // PUBLIC/VISIBILITY FILTERED
    // ═══════════════════════════════════════════════════════════════

    public List<Video> findPublicVideos(int page, int size) throws IOException {
        return findPublicVideos(page, size, null);
    }

    public List<Video> findPublicVideos(int page, int size, String userEmail) throws IOException {
        SearchResponse<ObjectNode> response = client.search(s -> s
                .index(indexName)
                .from(page * size)
                .size(size)
                .sort(so -> so.field(f -> f.field("uploadedAt").order(SortOrder.Desc)))
                .query(q -> q.bool(b -> {
                    var boolQuery = b.must(m -> m.term(t -> t.field("status").value(VideoStatus.READY.name())));
                    addVisibilityFilter(boolQuery, userEmail);
                    return boolQuery;
                })), ObjectNode.class);

        return extractVideos(response);
    }

    public long countPublicVideos() throws IOException {
        return countPublicVideos(null);
    }

    public long countPublicVideos(String userEmail) throws IOException {
        CountResponse response = client.count(c -> c
                .index(indexName)
                .query(q -> q.bool(b -> {
                    var boolQuery = b.must(m -> m.term(t -> t.field("status").value(VideoStatus.READY.name())));
                    addVisibilityFilter(boolQuery, userEmail);
                    return boolQuery;
                })));
        return response.count();
    }

    // ═══════════════════════════════════════════════════════════════
    // UPDATE / DELETE
    // ═══════════════════════════════════════════════════════════════

    public void updateStatus(String id, VideoStatus status) throws IOException {
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

    // ═══════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════

    private void addVisibilityFilter(co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery.Builder boolQuery,
                                     String userEmail) {
        if (userEmail != null) {
            String normalizedEmail = userEmail.toLowerCase().trim();
            boolQuery.filter(f -> f.bool(visFilter -> visFilter
                    .should(sh -> sh.term(t -> t
                            .field("visibility")
                            .value(VideoVisibility.PUBLIC.name())
                    ))
                    .should(sh -> sh.term(t -> t
                            .field("visibility")
                            .value(VideoVisibility.UNLISTED.name())
                    ))
                    .should(sh -> sh.bool(restrictedBool -> restrictedBool
                            .must(m -> m.term(t -> t
                                    .field("visibility")
                                    .value(VideoVisibility.RESTRICTED.name())
                            ))
                            .must(m -> m.term(t -> t
                                    .field("allowedEmails")
                                    .value(normalizedEmail)
                            ))
                    ))
                    .minimumShouldMatch("1")
            ));
        } else {
            boolQuery.filter(f -> f.term(t -> t
                    .field("visibility")
                    .value(VideoVisibility.PUBLIC.name())
            ));
        }
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
}