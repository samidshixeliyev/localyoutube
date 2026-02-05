package az.dev.localtube.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;

/**
 * CORS Configuration - Fixed to work without credentials for wildcard origin
 */
@Configuration
public class CorsConfig {

    @Bean
    public CorsFilter corsFilter() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();

        CorsConfiguration config = new CorsConfiguration();
        // Don't use allowCredentials with wildcard - it causes errors
        config.setAllowCredentials(false);
        config.addAllowedOriginPattern("*");

        config.setAllowedHeaders(Arrays.asList("*"));
        config.setAllowedMethods(Arrays.asList(
                "GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"
        ));

        config.setMaxAge(3600L);
        source.registerCorsConfiguration("/**", config);

        return new CorsFilter(source);
    }
}