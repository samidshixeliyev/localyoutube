package ao.az.modtube.websocket;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Media fan-out relay for video meetings. Each participant publishes WebCodecs-
 * encoded video/audio frames as binary WebSocket messages; this handler forwards
 * every frame to the other participants in the same room (an SFU-style relay that
 * runs entirely inside the app, over the single 443 WebSocket — no media ports).
 *
 * Wire format:
 *   client → server :  [1 kind][1 flags][8 ts(f64)][4 dur(u32)][payload]
 *   server → others :  [1 senderEmailLen][senderEmail bytes][ ...the client message ]
 *
 * The handler is intentionally dumb: it never decodes media, it only prepends the
 * sender's email and forwards bytes. CPU stays low; bandwidth fans out N×.
 */
@Slf4j
@Component
public class MeetingMediaHandler extends BinaryWebSocketHandler {

    /** Per-session outbound buffer for the concurrent decorator (a few keyframes). */
    private static final int SEND_BUFFER_BYTES = 8 * 1024 * 1024;
    private static final int SEND_TIME_LIMIT_MS = 5_000;

    private static final int KIND_CAMERA = 0;
    private static final int KIND_SCREEN = 1;
    private static final int KIND_AUDIO  = 2;
    private static final int KIND_CONTROL = 255;   // subscription update, not media

    private final ObjectMapper objectMapper = new ObjectMapper();

    /** roomCode → { sessionId → (concurrency-safe) session } */
    private final Map<String, Map<String, WebSocketSession>> rooms = new ConcurrentHashMap<>();

    /**
     * Selective forwarding: sessionId → set of sender-emails whose CAMERA video this
     * session currently wants (i.e. the tiles it's actually showing). Audio and
     * screen-share always go to everyone; camera video only to subscribers. This is
     * what lets 10-30 participants work — a client never receives 29 camera streams,
     * only the handful it's displaying.
     */
    private final Map<String, Set<String>> wantedCameras = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        // Wrap so concurrent fan-out sends to one receiver (from many publishers) are
        // serialized + buffered instead of corrupting the socket.
        WebSocketSession safe = new ConcurrentWebSocketSessionDecorator(
                session, SEND_TIME_LIMIT_MS, SEND_BUFFER_BYTES);
        rooms.computeIfAbsent(roomCode(session), k -> new ConcurrentHashMap<>())
             .put(session.getId(), safe);
    }

    @Override
    @SuppressWarnings("unchecked")
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) {
        Map<String, WebSocketSession> peers = rooms.get(roomCode(session));
        if (peers == null) return;

        ByteBuffer in = message.getPayload();
        byte[] data = new byte[in.remaining()];
        in.get(data);
        if (data.length < 1) return;

        int kind = data[0] & 0xFF;

        // Control frame: this session declares which senders' camera it wants.
        if (kind == KIND_CONTROL) {
            try {
                List<String> list = objectMapper.readValue(
                        new String(data, 1, data.length - 1, StandardCharsets.UTF_8), List.class);
                Set<String> set = new HashSet<>();
                for (String s : list) if (s != null) set.add(s.toLowerCase());
                wantedCameras.put(session.getId(), set);
            } catch (Exception ignored) { /* malformed control — ignore */ }
            return;
        }

        // Media frame → prepend sender email, fan out with selective camera forwarding.
        String email = (String) session.getAttributes().get("email");
        String emailLc = email == null ? "" : email.toLowerCase();
        byte[] emailBytes = email == null ? new byte[0] : email.getBytes(StandardCharsets.UTF_8);
        byte[] out = new byte[1 + emailBytes.length + data.length];
        out[0] = (byte) emailBytes.length;
        System.arraycopy(emailBytes, 0, out, 1, emailBytes.length);
        System.arraycopy(data, 0, out, 1 + emailBytes.length, data.length);

        boolean cameraVideo = (kind == KIND_CAMERA);   // audio + screen always broadcast

        for (var e : peers.entrySet()) {
            if (e.getKey().equals(session.getId())) continue;     // don't echo to sender
            if (cameraVideo) {
                Set<String> wanted = wantedCameras.get(e.getKey());
                if (wanted == null || !wanted.contains(emailLc)) continue;   // not displaying this tile
            }
            WebSocketSession s = e.getValue();
            if (!s.isOpen()) continue;
            try {
                s.sendMessage(new BinaryMessage(ByteBuffer.wrap(out)));
            } catch (Exception ex) {
                log.debug("media relay send failed to {}: {}", e.getKey(), ex.getMessage());
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        wantedCameras.remove(session.getId());
        Map<String, WebSocketSession> peers = rooms.get(roomCode(session));
        if (peers != null) {
            peers.remove(session.getId());
            if (peers.isEmpty()) rooms.remove(roomCode(session));
        }
    }

    private String roomCode(WebSocketSession session) {
        return (String) session.getAttributes().get("roomCode");
    }
}
