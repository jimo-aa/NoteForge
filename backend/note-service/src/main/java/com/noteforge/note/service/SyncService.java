package com.noteforge.note.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.noteforge.note.dto.*;
import com.noteforge.note.entity.NoteEntity;
import com.noteforge.note.entity.SyncLogEntity;
import com.noteforge.note.repository.NoteRepository;
import com.noteforge.note.repository.SyncLogRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class SyncService {

    private static final Logger log = LoggerFactory.getLogger(SyncService.class);
    private final SyncLogRepository syncLogRepository;
    private final NoteRepository noteRepository;
    private final SyncNotificationService syncNotificationService;
    private final ObjectMapper objectMapper;

    public SyncStateResponse getSyncState(String userId) {
        List<SyncLogEntity> logs = syncLogRepository
                .findByUserIdAndVersionGreaterThanOrderByVersionAsc(userId, 0L);
        long lastVersion = logs.stream().mapToLong(SyncLogEntity::getVersion).max().orElse(0);
        long pendingCount = syncLogRepository
                .findByUserIdAndVersionGreaterThanOrderByVersionAsc(userId, lastVersion).size();
        return new SyncStateResponse(lastVersion, (int) pendingCount, 0);
    }

    public SyncPullResponse pullChanges(String userId, long lastVersionMillis) {
        LocalDateTime since = LocalDateTime.ofInstant(
                Instant.ofEpochMilli(lastVersionMillis), ZoneId.systemDefault());
        List<NoteEntity> allNotes = noteRepository
                .findByUserIdAndUpdatedAtAfterOrderByUpdatedAtAsc(userId, since);

        List<NoteResponse> aliveNotes = new ArrayList<>();
        List<String> deletedIds = new ArrayList<>();

        for (NoteEntity entity : allNotes) {
            if (entity.isDeleted()) {
                deletedIds.add(entity.getId());
            } else {
                aliveNotes.add(NoteResponse.fromEntity(entity));
            }
        }

        // Server version = max(updatedAt from notes, max sync log version)
        long serverVersion = allNotes.stream()
                .mapToLong(n -> n.getUpdatedAt()
                        .atZone(ZoneId.systemDefault()).toInstant().toEpochMilli())
                .max()
                .orElse(lastVersionMillis);

        long syncVersion = syncLogRepository
                .findByUserIdAndVersionGreaterThanOrderByVersionAsc(userId, 0L)
                .stream()
                .mapToLong(SyncLogEntity::getVersion)
                .max()
                .orElse(0);
        serverVersion = Math.max(serverVersion, syncVersion);

        return new SyncPullResponse(aliveNotes, deletedIds, serverVersion);
    }

    @Transactional
    public SyncPushResponse pushChanges(String userId, SyncPushRequest request) {
        int accepted = 0;
        List<SyncPushResponse.ConflictItem> conflicts = new ArrayList<>();

        for (SyncPushRequest.SyncChangeItem item : request.getChanges()) {
            try {
                Optional<NoteEntity> existing = noteRepository.findById(item.getNoteId());

                if (existing.isPresent()) {
                    NoteEntity entity = existing.get();

                    // Ownership check
                    if (!entity.getUserId().equals(userId)) {
                        continue;
                    }

                    // Conflict detection: server version > client version
                    if (entity.getVersion() > item.getClientVersion()) {
                        conflicts.add(new SyncPushResponse.ConflictItem(
                                item.getNoteId(),
                                entity.getUpdatedAt()
                                        .atZone(ZoneId.systemDefault()).toInstant().toEpochMilli(),
                                entity.getVersion()));
                        continue;
                    }

                    // Apply updates
                    if (item.getTitle() != null) entity.setTitle(item.getTitle());
                    if (item.getContent() != null) {
                        entity.setContent(item.getContent());
                        entity.setContentPlain(stripHtml(item.getContent()));
                        entity.setWordCount(countWords(item.getContent()));
                    }
                    if (item.getNotebookId() != null) entity.setNotebookId(item.getNotebookId());
                    if (item.getTags() != null) entity.setTags(item.getTags());
                    if (item.getIsPinned() != null) entity.setPinned(item.getIsPinned());
                    if (item.getIsFavorite() != null) entity.setFavorite(item.getIsFavorite());
                    if (item.getIsDeleted() != null) entity.setDeleted(item.getIsDeleted());

                    entity.setVersion(entity.getVersion() + 1);
                    noteRepository.save(entity);

                } else {
                    // Create new note from sync
                    NoteEntity entity = new NoteEntity();
                    entity.setId(item.getNoteId());
                    entity.setUserId(userId);
                    entity.setTitle(item.getTitle() != null ? item.getTitle() : "");
                    String content = item.getContent() != null ? item.getContent() : "";
                    entity.setContent(content);
                    entity.setContentPlain(stripHtml(content));
                    entity.setWordCount(countWords(content));
                    entity.setNotebookId(item.getNotebookId());
                    if (item.getTags() != null) entity.setTags(item.getTags());
                    if (item.getIsPinned() != null) entity.setPinned(item.getIsPinned());
                    if (item.getIsFavorite() != null) entity.setFavorite(item.getIsFavorite());
                    if (item.getIsDeleted() != null) entity.setDeleted(item.getIsDeleted());
                    entity.setVersion(1);
                    noteRepository.save(entity);
                }

                // Record sync log
                NoteEntity saved = noteRepository.findById(item.getNoteId()).orElse(null);
                if (saved != null) {
                    recordSyncLog(saved,
                            item.getIsDeleted() != null && item.getIsDeleted() ? "DELETE" : "UPDATE");
                }
                accepted++;

            } catch (Exception e) {
                log.error("Failed to process sync change for note {}: {}",
                        item.getNoteId(), e.getMessage());
            }
        }

        long serverVersion = getMaxVersion(userId);

        // Notify connected clients about the sync completion
        if (accepted > 0) {
            syncNotificationService.notifySyncComplete(userId, serverVersion);
        }

        return new SyncPushResponse(accepted, serverVersion, conflicts);
    }

    public long getCurrentVersion(String userId) {
        return getMaxVersion(userId);
    }

    public List<String> resolveConflicts(String userId, long clientVersion) {
        List<SyncLogEntity> logs = syncLogRepository
                .findByUserIdAndVersionGreaterThanOrderByVersionAsc(userId, clientVersion);
        java.util.Map<String, Long> noteChangeCount = logs.stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        SyncLogEntity::getNoteId, java.util.stream.Collectors.counting()));
        return noteChangeCount.entrySet().stream()
                .filter(entry -> entry.getValue() > 1)
                .map(java.util.Map.Entry::getKey)
                .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
    }

    private long getMaxVersion(String userId) {
        List<SyncLogEntity> logs = syncLogRepository
                .findByUserIdAndVersionGreaterThanOrderByVersionAsc(userId, 0L);
        return logs.stream().mapToLong(SyncLogEntity::getVersion).max().orElse(0);
    }

    private void recordSyncLog(NoteEntity entity, String operation) {
        SyncLogEntity log = new SyncLogEntity();
        log.setNoteId(entity.getId());
        log.setUserId(entity.getUserId());
        log.setOperation(operation);
        log.setVersion(System.currentTimeMillis());
        try {
            log.setSnapshot(objectMapper.writeValueAsString(NoteResponse.fromEntity(entity)));
        } catch (JsonProcessingException e) {
            log.setSnapshot("{}");
        }
        syncLogRepository.save(log);
    }

    private String stripHtml(String html) {
        if (html == null) return "";
        return html.replaceAll("<[^>]*>", "");
    }

    private int countWords(String text) {
        if (text == null || text.isEmpty()) return 0;
        String clean = text.replaceAll("<[^>]*>", "");
        int count = 0;
        boolean inWord = false;
        for (char c : clean.toCharArray()) {
            if (Character.isLetterOrDigit(c)) {
                if (!inWord) { count++; inWord = true; }
            } else if (Character.isWhitespace(c)) {
                inWord = false;
            } else if (Character.isIdeographic(c)) {
                count++;
                inWord = false;
            }
        }
        return Math.max(count, 1);
    }
}
