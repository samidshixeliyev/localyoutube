package ao.az.modtube.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${modtube.storage.upload-dir}")
    private String uploadDir;

    @Value("${modtube.storage.hls-dir}")
    private String hlsDir;

    @Value("${modtube.storage.thumbnail-dir}")
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