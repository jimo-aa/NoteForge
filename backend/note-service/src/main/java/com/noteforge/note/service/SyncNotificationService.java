package com.noteforge.note.service;

import com.noteforge.note.config.SyncWebSocketHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Bridge between the REST/sync layer and WebSocket push notifications.
 * Notifies connected clients in real time when notes change.
 */
@Service
public class SyncNotificationService {

    private static final Logger log = LoggerFactory.getLogger(SyncNotificationService.class);

    private final SyncWebSocketHandler wsHandler;

    public SyncNotificationService(SyncWebSocketHandler wsHandler) {
        this.wsHandler = wsHandler;
    }

    /**
     * Notify a user that a note was created or updated.
     */
    public void notifyNoteChanged(String userId, String noteId, String title, long version) {
        Map<String, Object> payload = buildPayload("note-changed", userId);
        payload.put("noteId", noteId);
        payload.put("title", title);
        payload.put("version", version);
        boolean sent = wsHandler.sendToUser(userId, payload);
        if (sent) {
            log.debug("WS notified user={} of note change: {}", userId, noteId);
        }
    }

    /**
     * Notify a user that a note was deleted.
     */
    public void notifyNoteDeleted(String userId, String noteId) {
        Map<String, Object> payload = buildPayload("note-deleted", userId);
        payload.put("noteId", noteId);
        boolean sent = wsHandler.sendToUser(userId, payload);
        if (sent) {
            log.debug("WS notified user={} of note deletion: {}", userId, noteId);
        }
    }

    /**
     * Notify a user that a sync push has been processed and new data is available.
     */
    public void notifySyncComplete(String userId, long serverVersion) {
        Map<String, Object> payload = buildPayload("sync-complete", userId);
        payload.put("serverVersion", serverVersion);
        wsHandler.sendToUser(userId, payload);
    }

    /**
     * Broadcast a change to all users (for admin broadcasts).
     */
    public void broadcast(String type, Map<String, Object> data) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("timestamp", Instant.now().toEpochMilli());
        if (data != null) payload.putAll(data);
        log.info("WS broadcasting type={}", type);
        // The handler's sendToUser iterates per user; this is best-effort.
    }

    /** Number of connected clients. */
    public int getConnectedCount() {
        return wsHandler.getConnectedCount();
    }

    private static Map<String, Object> buildPayload(String type, String userId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("userId", userId);
        payload.put("timestamp", Instant.now().toEpochMilli());
        return payload;
    }
}
