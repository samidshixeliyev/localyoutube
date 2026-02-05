package az.dev.localtube.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${localtube.storage.upload-dir}")
    private String uploadDir;

    @Value("${localtube.storage.hls-dir}")
    private String hlsDir;

    @Value("${localtube.storage.thumbnail-dir}")
    private String thumbnailDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:" + uploadDir + "/")
                .setCachePeriod(3600);

        registry.addResourceHandler("/hls/**")
                .addResourceLocations("file:" + hlsDir + "/")
                .setCachePeriod(0);

        registry.addResourceHandler("/thumbnails/**")
                .addResourceLocations("file:" + thumbnailDir + "/")
                .setCachePeriod(3600);
    }
}