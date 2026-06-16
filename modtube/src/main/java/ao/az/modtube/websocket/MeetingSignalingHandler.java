package ao.az.modtube.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class MeetingSignalingHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper = new ObjectMapper();

    /** roomCode → { sessionId → session } */
    private final Map<String, Map<String, WebSocketSession>> rooms = new ConcurrentHashMap<>();

    /** roomCode → sessionId of the current screen sharer (null = nobody sharing) */
    private final Map<String, String> screenSharers = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String roomCode = roomCode(session);
        Map<String, WebSocketSession> room = rooms.computeIfAbsent(roomCode, k -> new ConcurrentHashMap<>());

        // Send existing peers list to the new joiner
        List<Map<String, Object>> peers = new ArrayList<>();
        for (WebSocketSession s : room.values()) {
            peers.add(peerInfo(s));
        }
        send(session, Map.of("type", "peers", "peers", peers));

        // If someone is already sharing, notify the new joiner immediately
        String currentSharer = screenSharers.get(roomCode);
        if (currentSharer != null) {
            WebSocketSession sharerSession = room.get(currentSharer);
            if (sharerSession != null && sharerSession.isOpen()) {
                Map<String, Object> shareState = new HashMap<>();
                shareState.put("type",  "screen-start");
                shareState.put("from",  currentSharer);
                shareState.put("email", sharerSession.getAttributes().get("email"));
                shareState.put("name",  sharerSession.getAttributes().get("name"));
                send(session, shareState);
            } else {
                screenSharers.remove(roomCode);
            }
        }

        room.put(session.getId(), session);

        Map<String, Object> joined = new HashMap<>(peerInfo(session));
        joined.put("type", "peer-joined");
        broadcast(room, session.getId(), joined);
    }

    @Override
    @SuppressWarnings("unchecked")
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Map<String, Object> payload = objectMapper.readValue(message.getPayload(), Map.class);
        String type = (String) payload.get("type");
        if (type == null) return;

        String roomCode = roomCode(session);
        Map<String, WebSocketSession> room = rooms.get(roomCode);
        if (room == null) return;

        switch (type) {
            case "offer", "answer", "ice-candidate" -> {
                Object targetId = payload.get("target");
                WebSocketSession target = targetId != null ? room.get(targetId.toString()) : null;
                if (target != null && target.isOpen()) {
                    Map<String, Object> outgoing = new HashMap<>(payload);
                    outgoing.put("from", session.getId());
                    send(target, outgoing);
                }
            }
            case "screen-start" -> {
                // Only allow if nobody else is currently sharing
                String current = screenSharers.get(roomCode);
                if (current != null && !current.equals(session.getId())) {
                    // Reject: tell the requester someone else is already sharing
                    Map<String, Object> reject = new HashMap<>();
                    reject.put("type",   "screen-rejected");
                    reject.put("reason", "Başqa istifadəçi artıq ekranını paylaşır");
                    send(session, reject);
                    return;
                }
                screenSharers.put(roomCode, session.getId());
                Map<String, Object> msg = new HashMap<>();
                msg.put("type",  "screen-start");
                msg.put("from",  session.getId());
                msg.put("email", session.getAttributes().get("email"));
                msg.put("name",  session.getAttributes().get("name"));
                broadcastAll(room, msg);
            }
            case "screen-stop" -> {
                // Only the current sharer can stop
                screenSharers.remove(roomCode, session.getId());
                Map<String, Object> msg = new HashMap<>();
                msg.put("type",  "screen-stop");
                msg.put("from",  session.getId());
                msg.put("email", session.getAttributes().get("email"));
                broadcastAll(room, msg);
            }
            case "chat" -> {
                Map<String, Object> msg = new HashMap<>();
                msg.put("type",  "chat");
                msg.put("from",  session.getId());
                msg.put("email", session.getAttributes().get("email"));
                msg.put("name",  session.getAttributes().get("name"));
                msg.put("text",  payload.get("text"));
                msg.put("ts",    System.currentTimeMillis());
                broadcastAll(room, msg);
            }
            default -> log.debug("Unhandled signaling message type: {}", type);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String roomCode = roomCode(session);
        Map<String, WebSocketSession> room = rooms.get(roomCode);
        if (room == null) return;

        room.remove(session.getId());

        // If this peer was sharing screen, broadcast screen-stop to everyone
        if (screenSharers.remove(roomCode, session.getId())) {
            Map<String, Object> stopMsg = new HashMap<>();
            stopMsg.put("type",  "screen-stop");
            stopMsg.put("from",  session.getId());
            stopMsg.put("email", session.getAttributes().get("email"));
            broadcastAll(room, stopMsg);
        }

        broadcast(room, session.getId(), Map.of("type", "peer-left", "id", session.getId()));

        if (room.isEmpty()) {
            rooms.remove(roomCode);
            screenSharers.remove(roomCode);
        }
    }

    public void endRoom(String roomCode) {
        Map<String, WebSocketSession> room = rooms.remove(roomCode);
        screenSharers.remove(roomCode);
        if (room == null) return;
        for (WebSocketSession s : room.values()) {
            send(s, Map.of("type", "meeting-ended"));
            try { s.close(CloseStatus.NORMAL); } catch (Exception ignored) {}
        }
    }

    private Map<String, Object> peerInfo(WebSocketSession session) {
        Map<String, Object> info = new HashMap<>();
        info.put("id",    session.getId());
        info.put("email", session.getAttributes().get("email"));
        info.put("name",  session.getAttributes().get("name"));
        return info;
    }

    private String roomCode(WebSocketSession session) {
        return (String) session.getAttributes().get("roomCode");
    }

    private void broadcast(Map<String, WebSocketSession> room, String excludeId, Map<String, Object> payload) {
        for (var entry : room.entrySet()) {
            if (entry.getKey().equals(excludeId)) continue;
            send(entry.getValue(), payload);
        }
    }

    private void broadcastAll(Map<String, WebSocketSession> room, Map<String, Object> payload) {
        room.values().forEach(s -> send(s, payload));
    }

    private void send(WebSocketSession session, Map<String, Object> payload) {
        try {
            if (session.isOpen()) {
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(payload)));
            }
        } catch (Exception e) {
            log.debug("Failed to send WS message to {}: {}", session.getId(), e.getMessage());
        }
    }
}
