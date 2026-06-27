package com.noteforge.note.service;

import com.noteforge.note.dto.*;
import com.noteforge.note.entity.NoteEntity;
import com.noteforge.note.entity.SyncLogEntity;
import com.noteforge.note.repository.NoteRepository;
import com.noteforge.note.repository.SyncLogRepository;
import lombok.RequiredArgsConstructor;
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
    private final SyncLogRepository syncLogRepository;

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

    public NoteResponse getNote(String noteId, String userId) {
        NoteEntity entity = findNote(noteId, userId);
        return NoteResponse.fromEntity(entity);
    }

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
        recordSyncLog(entity, "UPDATE");
        return NoteResponse.fromEntity(entity);
    }

    @Transactional
    public void deleteNote(String noteId, String userId) {
        NoteEntity entity = findNote(noteId, userId);
        entity.setDeleted(true);
        noteRepository.save(entity);
        recordSyncLog(entity, "DELETE");
    }

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
        return noteRepository.searchByFullText(userId, query, pageable)
                .map(NoteResponse::fromEntity);
    }

    private NoteEntity findNote(String noteId, String userId) {
        NoteEntity entity = noteRepository.findById(noteId)
                .orElseThrow(() -> new IllegalArgumentException("Note not found"));
        if (!entity.getUserId().equals(userId) || entity.isDeleted()) {
            throw new IllegalArgumentException("Note not found");
        }
        return entity;
    }

    private void recordSyncLog(NoteEntity entity, String operation) {
        SyncLogEntity log = new SyncLogEntity();
        log.setNoteId(entity.getId());
        log.setUserId(entity.getUserId());
        log.setOperation(operation);
        log.setVersion(System.currentTimeMillis());
        log.setSnapshot(/* TODO: serialize entity to JSON */ "");
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
