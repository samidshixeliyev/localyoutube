package ao.az.modtube.config;

import ao.az.modtube.config.security.MeetingHandshakeInterceptor;
import ao.az.modtube.websocket.MeetingSignalingHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

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
}
