package az.dev.localtube.service;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.mapping.Property;
import co.elastic.clients.elasticsearch._types.mapping.TypeMapping;
import co.elastic.clients.elasticsearch.indices.CreateIndexRequest;
import co.elastic.clients.elasticsearch.indices.ExistsRequest;
import co.elastic.clients.elasticsearch.indices.GetMappingResponse;
import co.elastic.clients.elasticsearch.indices.get_mapping.IndexMappingRecord;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * Manages Elasticsearch index creation and schema migration.
 * On startup, each repository calls ensureIndexMapping() which:
 *   1) Creates the index if it doesn't exist
 *   2) Detects new fields and adds them via PUT mapping (non-destructive)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ElasticsearchIndexManager {

    private final ElasticsearchClient client;

    /**
     * Ensure index exists with required mappings.
     * If index exists, detect new fields and add them.
     *
     * @param indexName        Elasticsearch index name
     * @param requiredFields   Map of field name -> Property definition
     * @param shards           Number of shards
     * @param replicas         Number of replicas
     * @param refreshInterval  Refresh interval (e.g. "1s")
     */
    public void ensureIndexMapping(String indexName,
                                   Map<String, Property> requiredFields,
                                   String shards,
                                   String replicas,
                                   String refreshInterval) throws IOException {

        boolean exists = client.indices().exists(ExistsRequest.of(e -> e.index(indexName))).value();

        if (!exists) {
            createIndex(indexName, requiredFields, shards, replicas, refreshInterval);
            return;
        }

        // Index exists — check for new fields
        updateMappingIfNeeded(indexName, requiredFields);
    }

    /**
     * Simplified overload with defaults
     */
    public void ensureIndexMapping(String indexName,
                                   Map<String, Property> requiredFields) throws IOException {
        ensureIndexMapping(indexName, requiredFields, "1", "0", "1s");
    }

    private void createIndex(String indexName,
                             Map<String, Property> fields,
                             String shards,
                             String replicas,
                             String refreshInterval) throws IOException {

        client.indices().create(CreateIndexRequest.of(c -> c
                .index(indexName)
                .mappings(m -> m.properties(fields))
                .settings(s -> s
                        .numberOfShards(shards)
                        .numberOfReplicas(replicas)
                        .refreshInterval(time -> time.time(refreshInterval))
                )
        ));

        log.info("[IndexManager] Created index '{}' with {} fields", indexName, fields.size());
    }

    private void updateMappingIfNeeded(String indexName,
                                       Map<String, Property> requiredFields) throws IOException {

        // Get current mappings
        GetMappingResponse mappingResponse = client.indices().getMapping(g -> g.index(indexName));
        IndexMappingRecord record = mappingResponse.get(indexName);

        if (record == null || record.mappings() == null) {
            log.warn("[IndexManager] Could not read mappings for index '{}'", indexName);
            return;
        }

        Map<String, Property> existingProps = record.mappings().properties();
        Set<String> existingFieldNames = existingProps != null ? existingProps.keySet() : Set.of();

        // Find fields that exist in required but not in current index
        Map<String, Property> newFields = new HashMap<>();
        for (Map.Entry<String, Property> entry : requiredFields.entrySet()) {
            if (!existingFieldNames.contains(entry.getKey())) {
                newFields.put(entry.getKey(), entry.getValue());
            }
        }

        if (newFields.isEmpty()) {
            log.debug("[IndexManager] Index '{}' mappings are up to date ({} fields)",
                    indexName, existingFieldNames.size());
            return;
        }

        // Apply new mappings — ES supports adding new fields without reindex
        client.indices().putMapping(p -> p
                .index(indexName)
                .properties(newFields)
        );

        log.info("[IndexManager] Updated index '{}' with {} new field(s): {}",
                indexName, newFields.size(), newFields.keySet());
    }
}