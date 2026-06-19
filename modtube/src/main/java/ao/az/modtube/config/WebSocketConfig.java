package ao.az.modtube.config;

import ao.az.modtube.config.security.MeetingHandshakeInterceptor;
import ao.az.modtube.websocket.MeetingMediaHandler;
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
    private final MeetingMediaHandler meetingMediaHandler;
    private final MeetingHandshakeInterceptor meetingHandshakeInterceptor;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Text: chat / roster / moderation / lifecycle.  /ws/meetings/{roomCode}
        registry.addHandler(meetingSignalingHandler, "/ws/meetings/*")
                .addInterceptors(meetingHandshakeInterceptor)
                .setAllowedOriginPatterns("*");
        // Binary: WebCodecs media fan-out.  /ws/meetings/media/{roomCode}
        // (two path segments, so it does NOT collide with /ws/meetings/* above)
        registry.addHandler(meetingMediaHandler, "/ws/meetings/media/*")
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
        // Media keyframes (esp. screen share) can be a few hundred KB — allow headroom.
        container.setMaxBinaryMessageBufferSize(4 * 1024 * 1024);
        return container;
    }
}
