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
    private final ObjectMapper objectMapper;

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
        return NoteResponse.fromEntity(entity);
    }

    @Transactional
    @CacheEvict(value = "notes:list", key = "#userId")
    public void deleteNote(String noteId, String userId) {
        NoteEntity entity = findNote(noteId, userId);
        entity.setDeleted(true);
        noteRepository.save(entity);
        recordSyncLog(entity, "DELETE");
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

    public List<NoteResponse> listNotesWithFilter(String userId, String notebookId, String tag, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<NoteEntity> entities;
        if (tag != null && !tag.isEmpty()) {
            entities = noteRepository.findByUserIdAndTagAndIsDeletedFalse(userId, tag, pageable);
        } else if (notebookId != null && !notebookId.isEmpty()) {
            entities = noteRepository.findByUserIdAndNotebookIdAndIsDeletedFalse(userId, notebookId, pageable);
        } else {
            entities = noteRepository.findByUserIdAndIsDeletedFalse(userId, pageable);
        }
        return entities.map(NoteResponse::fromEntity).getContent();
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
