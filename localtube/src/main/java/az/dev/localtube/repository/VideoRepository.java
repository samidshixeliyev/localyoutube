package az.dev.localtube.repository;

import az.dev.localtube.domain.Comment;
import az.dev.localtube.domain.Video;
import az.dev.localtube.domain.VideoStatus;
import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.Result;
import co.elastic.clients.elasticsearch.core.*;
import co.elastic.clients.elasticsearch.core.search.Hit;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Video repository using Elasticsearch core client
 * Fixed: Uses injected ObjectMapper with JavaTimeModule
 */
@Repository
public class VideoRepository {

    private final ElasticsearchClient client;
    private final String indexName;
    private final ObjectMapper objectMapper;

    public VideoRepository(ElasticsearchClient client,
                           @Qualifier("elasticsearchObjectMapper") ObjectMapper objectMapper,
                           @Value("${localtube.elasticsearch.index}") String indexName) {
        this.client = client;
        this.indexName = indexName;
        this.objectMapper = objectMapper;
    }

    /**
     * Save or update a video
     */
    public Video save(Video video) throws IOException {
        if (video.getId() == null) {
            video.setId(generateId());
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> document = objectMapper.convertValue(video, Map.class);

        IndexRequest<Map<String, Object>> request = IndexRequest.of(i -> i
                .index(indexName)
                .id(video.getId())
                .document(document)
        );

        IndexResponse response = client.index(request);

        if (response.result() == Result.Created || response.result() == Result.Updated) {
            System.out.println("[ES] Saved video: " + video.getId());
            return video;
        }

        throw new IOException("Failed to save video: " + response.result());
    }

    /**
     * Find video by ID
     */
    public Optional<Video> findById(String id) throws IOException {
        try {
            GetResponse<ObjectNode> response = client.get(g -> g
                            .index(indexName)
                            .id(id),
                    ObjectNode.class
            );

            if (response.found() && response.source() != null) {
                Video video = objectMapper.treeToValue(response.source(), Video.class);
                return Optional.of(video);
            }

            return Optional.empty();

        } catch (Exception e) {
            System.err.println("[ES] Error finding video " + id + ": " + e.getMessage());
            e.printStackTrace();
            return Optional.empty();
        }
    }

    /**
     * Find all videos
     */
    public List<Video> findAll() throws IOException {
        SearchResponse<ObjectNode> response = client.search(s -> s
                        .index(indexName)
                        .size(1000)
                        .query(q -> q.matchAll(m -> m)),
                ObjectNode.class
        );

        List<Video> videos = new ArrayList<>();
        for (Hit<ObjectNode> hit : response.hits().hits()) {
            if (hit.source() != null) {
                try {
                    Video video = objectMapper.treeToValue(hit.source(), Video.class);
                    videos.add(video);
                } catch (Exception e) {
                    System.err.println("[ES] Error parsing video: " + e.getMessage());
                }
            }
        }

        return videos;
    }

    /**
     * Find videos by status
     */
    public List<Video> findByStatus(VideoStatus status) throws IOException {
        SearchResponse<ObjectNode> response = client.search(s -> s
                        .index(indexName)
                        .query(q -> q
                                .term(t -> t
                                        .field("status")
                                        .value(status.name())
                                )
                        ),
                ObjectNode.class
        );

        List<Video> videos = new ArrayList<>();
        for (Hit<ObjectNode> hit : response.hits().hits()) {
            if (hit.source() != null) {
                try {
                    Video video = objectMapper.treeToValue(hit.source(), Video.class);
                    videos.add(video);
                } catch (Exception e) {
                    System.err.println("[ES] Error parsing video: " + e.getMessage());
                }
            }
        }

        return videos;
    }

    /**
     * Search videos by title or description
     */
    public List<Video> search(String query) throws IOException {
        SearchResponse<ObjectNode> response = client.search(s -> s
                        .index(indexName)
                        .query(q -> q
                                .multiMatch(m -> m
                                        .query(query)
                                        .fields("title^2", "description")
                                )
                        ),
                ObjectNode.class
        );

        List<Video> videos = new ArrayList<>();
        for (Hit<ObjectNode> hit : response.hits().hits()) {
            if (hit.source() != null) {
                try {
                    Video video = objectMapper.treeToValue(hit.source(), Video.class);
                    videos.add(video);
                } catch (Exception e) {
                    System.err.println("[ES] Error parsing video: " + e.getMessage());
                }
            }
        }

        return videos;
    }

    /**
     * Update video status
     */
    public void updateStatus(String id, VideoStatus status) throws IOException {
        client.update(u -> u
                        .index(indexName)
                        .id(id)
                        .doc(Map.of("status", status.name())),
                ObjectNode.class
        );
        System.out.println("[ES] Updated video " + id + " status to " + status);
    }

    /**
     * Add available quality to video
     */
    public void addQuality(String id, String quality) throws IOException {
        Optional<Video> videoOpt = findById(id);
        if (videoOpt.isPresent()) {
            Video video = videoOpt.get();
            video.addQuality(quality);
            save(video);
            System.out.println("[ES] Added quality " + quality + " to video " + id);
        }
    }

    /**
     * Increment view count
     */
    public void incrementViews(String id) throws IOException {
        Optional<Video> videoOpt = findById(id);
        if (videoOpt.isPresent()) {
            Video video = videoOpt.get();
            video.incrementViews();
            save(video);
        }
    }

    /**
     * Increment likes count
     */
    public void incrementLikes(String id) throws IOException {
        Optional<Video> videoOpt = findById(id);
        if (videoOpt.isPresent()) {
            Video video = videoOpt.get();
            video.incrementLikes();
            save(video);
        }
    }

    /**
     * Add comment to video
     */
    public void addComment(String videoId, Comment comment) throws IOException {
        if (comment.getId() == null) {
            comment.setId(generateId());
        }

        Optional<Video> videoOpt = findById(videoId);
        if (videoOpt.isPresent()) {
            Video video = videoOpt.get();
            video.addComment(comment);
            save(video);
            System.out.println("[ES] Added comment to video " + videoId);
        }
    }

    /**
     * Delete video
     */
    public void delete(String id) throws IOException {
        DeleteResponse response = client.delete(d -> d
                .index(indexName)
                .id(id)
        );
        System.out.println("[ES] Deleted video: " + id + " - Result: " + response.result());
    }

    /**
     * Check if index exists, create if not
     */
    public void ensureIndex() throws IOException {
        boolean exists = client.indices().exists(e -> e.index(indexName)).value();

        if (!exists) {
            client.indices().create(c -> c
                    .index(indexName)
                    .mappings(m -> m
                            .properties("id", p -> p.keyword(k -> k))
                            .properties("title", p -> p.text(t -> t.analyzer("standard")))
                            .properties("description", p -> p.text(t -> t.analyzer("standard")))
                            .properties("filename", p -> p.keyword(k -> k))
                            .properties("status", p -> p.keyword(k -> k))
                            .properties("availableQualities", p -> p.keyword(k -> k))
                            .properties("uploadedAt", p -> p.date(d -> d.format("strict_date_optional_time||epoch_millis")))
                            .properties("processedAt", p -> p.date(d -> d.format("strict_date_optional_time||epoch_millis")))
                            .properties("views", p -> p.long_(l -> l))
                            .properties("likes", p -> p.long_(l -> l))
                            .properties("width", p -> p.integer(i -> i))
                            .properties("height", p -> p.integer(i -> i))
                            .properties("durationSeconds", p -> p.integer(i -> i))
                            .properties("fileSize", p -> p.long_(l -> l))
                    )
            );
            System.out.println("[ES] Created index: " + indexName);
        }
    }

    private String generateId() {
        return System.currentTimeMillis() + "_" + (int)(Math.random() * 10000);
    }
}