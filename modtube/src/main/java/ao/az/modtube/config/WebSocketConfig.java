package ao.az.modtube.config;

import ao.az.modtube.config.security.MeetingHandshakeInterceptor;
import ao.az.modtube.websocket.MeetingSignalingHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final MeetingSignalingHandler meetingSignalingHandler;
    private final MeetingHandshakeInterceptor meetingHandshakeInterceptor;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(meetingSignalingHandler, "/ws/meetings/*")
                .addInterceptors(meetingHandshakeInterceptor)
                .setAllowedOriginPatterns("*");
    }

    /**
     * Raise the WS text-message limit above the 8 KB default. SDP offers/answers and
     * the replayed chat history (with attachment metadata) can exceed 8 KB; without
     * this they'd be split/dropped and break signaling or history replay.
     */
    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(512 * 1024);
        container.setMaxBinaryMessageBufferSize(512 * 1024);
        return container;
    }
}
