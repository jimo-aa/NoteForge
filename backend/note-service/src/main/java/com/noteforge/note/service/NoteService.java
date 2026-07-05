package com.noteforge.note.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.noteforge.note.dto.*;
import com.noteforge.note.entity.NoteEntity;
import com.noteforge.note.entity.NoteLinkEntity;
import com.noteforge.note.entity.NoteVersionEntity;
import com.noteforge.note.entity.SyncLogEntity;
import com.noteforge.note.exception.ResourceNotFoundException;
import com.noteforge.note.repository.NoteLinkRepository;
import com.noteforge.note.repository.NoteRepository;
import com.noteforge.note.repository.NoteVersionRepository;
import com.noteforge.note.repository.SyncLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NoteService {

    private final NoteRepository noteRepository;
    private final NoteLinkRepository noteLinkRepository;
    private final NoteVersionRepository noteVersionRepository;
    private final SyncLogRepository syncLogRepository;
    private final SyncNotificationService syncNotificationService;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    private NoteIndexService noteIndexService;

    @CacheEvict(value = "notes:list", key = "#userId")
    public NoteResponse createNote(String userId, NoteCreateRequest req) {
        NoteEntity entity = new NoteEntity();
        entity.setUserId(userId);
        entity.setTitle(req.getTitle());
        String content = req.getContent() != null ? req.getContent() : "";
        entity.setContent(content);
        entity.setContentPlain(stripHtml(content));
        entity.setWordCount(countWords(content));
        entity.setNotebookId(req.getNotebookId());
        if (req.getTags() != null) entity.setTags(req.getTags());
        noteRepository.save(entity);
        recordSyncLog(entity, "CREATE");
        syncNotificationService.notifyNoteChanged(userId, entity.getId(), entity.getTitle(), entity.getVersion());
        auditService.record(userId, "CREATE", "NOTE", entity.getId(), "创建笔记: " + entity.getTitle());
        if (noteIndexService != null) noteIndexService.indexNote(entity);
        return NoteResponse.fromEntity(entity);
    }

    @Cacheable(value = "notes:detail", key = "#noteId", unless = "#result == null")
    public NoteResponse getNote(String noteId, String userId) {
        NoteEntity entity = findNote(noteId, userId);
        return NoteResponse.fromEntity(entity);
    }

    @CacheEvict(value = "notes:list", key = "#userId")
    public NoteResponse updateNote(String noteId, String userId, NoteUpdateRequest req) {
        NoteEntity entity = findNote(noteId, userId);
        if (req.getTitle() != null) entity.setTitle(req.getTitle());
        if (req.getContent() != null) {
            entity.setContent(req.getContent());
            entity.setContentPlain(stripHtml(req.getContent()));
            entity.setWordCount(countWords(req.getContent()));
        }
        if (req.getNotebookId() != null) entity.setNotebookId(req.getNotebookId());
        if (req.getTags() != null) entity.setTags(req.getTags());
        if (req.getIsPinned() != null) entity.setPinned(req.getIsPinned());
        if (req.getIsFavorite() != null) entity.setFavorite(req.getIsFavorite());
        entity.setVersion(entity.getVersion() + 1);
        noteRepository.save(entity);

        // Auto-create version snapshot on update
        NoteVersionEntity version = new NoteVersionEntity();
        version.setNoteId(entity.getId());
        version.setUserId(entity.getUserId());
        version.setVersionNumber(entity.getVersion());
        version.setTitle(entity.getTitle());
        version.setContent(entity.getContent());
        version.setContentPlain(entity.getContentPlain());
        noteVersionRepository.save(version);

        recordSyncLog(entity, "UPDATE");
        syncNotificationService.notifyNoteChanged(userId, entity.getId(), entity.getTitle(), entity.getVersion());
        auditService.record(userId, "UPDATE", "NOTE", noteId, "更新笔记: " + entity.getTitle());
        if (noteIndexService != null) noteIndexService.indexNote(entity);
        return NoteResponse.fromEntity(entity);
    }

    @Transactional
    @CacheEvict(value = "notes:list", key = "#userId")
    public void deleteNote(String noteId, String userId) {
        NoteEntity entity = findNote(noteId, userId);
        entity.setDeleted(true);
        noteRepository.save(entity);
        recordSyncLog(entity, "DELETE");
        syncNotificationService.notifyNoteDeleted(userId, noteId);
        auditService.record(userId, "DELETE", "NOTE", noteId, "删除笔记: " + entity.getTitle());
        if (noteIndexService != null) noteIndexService.removeNote(noteId, userId);
    }

    @Cacheable(value = "notes:list", key = "#userId + ':' + #notebookId + ':' + #page + ':' + #size",
               unless = "#result.isEmpty()")
    public List<NoteResponse> listNotes(String userId, String notebookId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<NoteEntity> entities;
        if (notebookId != null && !notebookId.isEmpty()) {
            entities = noteRepository.findByUserIdAndNotebookIdAndIsDeletedFalse(userId, notebookId, pageable);
        } else {
            entities = noteRepository.findByUserIdAndIsDeletedFalse(userId, pageable);
        }
        return entities.map(NoteResponse::fromEntity).getContent();
    }

    public Page<NoteResponse> searchNotesFuzzy(String userId, String query, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        if (query == null || query.isBlank()) {
            return Page.empty(pageable);
        }
        try {
            return noteRepository.searchByFuzzy(userId, query.trim(), pageable)
                    .map(NoteResponse::fromEntity);
        } catch (Exception e) {
            // Fallback to LIKE for non-PostgreSQL DBs (e.g. H2 in tests)
            return noteRepository.searchByLike(userId, query.trim(), pageable)
                    .map(NoteResponse::fromEntity);
        }
    }

    public Page<NoteResponse> searchNotes(String userId, String query, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        try {
            return noteRepository.searchByFullText(userId, query, pageable)
                    .map(NoteResponse::fromEntity);
        } catch (Exception e) {
            // Fallback: non-PostgreSQL DB (e.g. H2 in tests) lacks to_tsvector
            return noteRepository.searchByLike(userId, query, pageable)
                    .map(NoteResponse::fromEntity);
        }
    }

    public List<NoteLinkResponse> getBacklinks(String noteId, String userId) {
        List<NoteLinkEntity> links = noteLinkRepository.findByTargetNoteIdAndUserId(noteId, userId);
        return links.stream().map(link -> {
            NoteEntity source = noteRepository.findById(link.getSourceNoteId()).orElse(null);
            if (source == null || source.isDeleted() || !source.getUserId().equals(userId)) {
                return null;
            }
            return new NoteLinkResponse(
                source.getId(),
                source.getTitle(),
                source.getUpdatedAt().toEpochSecond(java.time.ZoneOffset.UTC) * 1000
            );
        }).filter(r -> r != null).toList();
    }

    public Page<NoteResponse> listNotesWithFilter(String userId, String notebookId, String tag,
                                                   Boolean isFavorite, Boolean isPinned,
                                                   int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<NoteEntity> entities;

        if (isFavorite != null && isFavorite) {
            entities = noteRepository.findByUserIdAndIsFavoriteAndIsDeletedFalse(userId, pageable);
        } else if (isPinned != null && isPinned) {
            entities = noteRepository.findByUserIdAndIsPinnedAndIsDeletedFalse(userId, pageable);
        } else if (tag != null && !tag.isEmpty()) {
            entities = noteRepository.findByUserIdAndTagAndIsDeletedFalse(userId, tag, pageable);
        } else if (notebookId != null && !notebookId.isEmpty()) {
            entities = noteRepository.findByUserIdAndNotebookIdAndIsDeletedFalse(userId, notebookId, pageable);
        } else {
            entities = noteRepository.findByUserIdAndIsDeletedFalse(userId, pageable);
        }

        return entities.map(NoteResponse::fromEntity);
    }

    private NoteEntity findNote(String noteId, String userId) {
        NoteEntity entity = noteRepository.findById(noteId)
                .orElseThrow(() -> new ResourceNotFoundException("Note not found"));
        if (!entity.getUserId().equals(userId) || entity.isDeleted()) {
            throw new ResourceNotFoundException("Note not found");
        }
        return entity;
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
