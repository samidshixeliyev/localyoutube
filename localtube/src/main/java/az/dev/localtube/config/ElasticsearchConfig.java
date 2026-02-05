package az.dev.localtube.config;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.json.jackson.JacksonJsonpMapper;
import co.elastic.clients.transport.ElasticsearchTransport;
import co.elastic.clients.transport.rest_client.RestClientTransport;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.http.HttpHost;
import org.apache.http.auth.AuthScope;
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.client.CredentialsProvider;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.elasticsearch.client.RestClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Elasticsearch configuration with proper DateTime handling
 */
@Configuration
public class ElasticsearchConfig {

    @Value("${localtube.elasticsearch.host}")
    private String host;

    @Value("${localtube.elasticsearch.port}")
    private int port;

    @Value("${localtube.elasticsearch.scheme}")
    private String scheme;

    @Value("${localtube.elasticsearch.username:}")
    private String username;

    @Value("${localtube.elasticsearch.password:}")
    private String password;

    @Bean
    public ObjectMapper elasticsearchObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        return mapper;
    }

    @Bean
    public RestClient restClient() {
        HttpHost httpHost = new HttpHost(host, port, scheme);
        var builder = RestClient.builder(httpHost);

        if (username != null && !username.isEmpty()) {
            CredentialsProvider credentialsProvider = new BasicCredentialsProvider();
            credentialsProvider.setCredentials(
                    AuthScope.ANY,
                    new UsernamePasswordCredentials(username, password)
            );
            builder.setHttpClientConfigCallback(httpClientBuilder ->
                    httpClientBuilder.setDefaultCredentialsProvider(credentialsProvider)
            );
        }

        return builder.build();
    }

    @Bean
    public ElasticsearchTransport elasticsearchTransport(RestClient restClient, ObjectMapper elasticsearchObjectMapper) {
        return new RestClientTransport(
                restClient,
                new JacksonJsonpMapper(elasticsearchObjectMapper)
        );
    }

    @Bean
    public ElasticsearchClient elasticsearchClient(ElasticsearchTransport transport) {
        return new ElasticsearchClient(transport);
    }
}