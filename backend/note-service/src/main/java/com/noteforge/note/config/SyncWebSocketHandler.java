package com.noteforge.note.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.noteforge.note.entity.SyncLogEntity;
import com.noteforge.note.repository.SyncLogRepository;
import com.noteforge.note.security.JwtTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SyncWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(SyncWebSocketHandler.class);

    private final JwtTokenProvider jwtTokenProvider;
    private final SyncLogRepository syncLogRepository;
    private final ObjectMapper objectMapper;

    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    public SyncWebSocketHandler(JwtTokenProvider jwtTokenProvider,
                                 SyncLogRepository syncLogRepository,
                                 ObjectMapper objectMapper) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.syncLogRepository = syncLogRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String userId = authenticate(session);
        if (userId == null) {
            closeSession(session, CloseStatus.POLICY_VIOLATION);
            return;
        }
        sessions.put(userId, session);
        log.info("WebSocket connected: userId={}, sessionId={}", userId, session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        String userId = authenticate(session);
        if (userId == null) {
            closeSession(session, CloseStatus.POLICY_VIOLATION);
            return;
        }

        JsonNode payload = objectMapper.readTree(message.getPayload());
        String type = payload.path("type").asText("");

        switch (type) {
            case "ping" -> {
                session.sendMessage(new TextMessage("{\"type\":\"pong\"}"));
            }
            case "pull" -> {
                long lastVersion = payload.path("lastVersion").asLong(0);
                List<SyncLogEntity> changes = syncLogRepository
                        .findByUserIdAndVersionGreaterThanOrderByVersionAsc(userId, lastVersion);
                String json = objectMapper.writeValueAsString(Map.of(
                        "type", "sync",
                        "changes", changes
                ));
                session.sendMessage(new TextMessage(json));
            }
            default -> log.warn("Unknown message type: {}", type);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String userId = authenticate(session);
        if (userId != null) {
            sessions.remove(userId);
            log.info("WebSocket disconnected: userId={}, sessionId={}", userId, session.getId());
        }
    }

    private String authenticate(WebSocketSession session) {
        URI uri = session.getUri();
        if (uri == null) return null;

        // Try query param first: ?token=xxx
        String token = uri.getQuery();
        if (token != null && token.startsWith("token=")) {
            token = token.substring(6);
            if (jwtTokenProvider.validateToken(token)) {
                return jwtTokenProvider.getUserIdFromToken(token);
            }
        }

        // Try header: Sec-WebSocket-Protocol: <token>
        List<String> protocols = session.getHandshakeHeaders().get("Sec-WebSocket-Protocol");
        if (protocols != null && !protocols.isEmpty()) {
            token = protocols.get(0);
            if (jwtTokenProvider.validateToken(token)) {
                return jwtTokenProvider.getUserIdFromToken(token);
            }
        }

        return null;
    }

    private void closeSession(WebSocketSession session, CloseStatus status) {
        try {
            session.close(status);
        } catch (IOException e) {
            log.warn("Failed to close WebSocket session: {}", e.getMessage());
        }
    }
}
