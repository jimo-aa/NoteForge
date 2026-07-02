package com.noteforge.note.service;

import com.noteforge.note.document.NoteDocument;
import com.noteforge.note.entity.NoteEntity;
import com.noteforge.note.repository.NoteSearchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "elasticsearch.enabled", havingValue = "true")
@Slf4j
public class NoteIndexService {

    private final NoteSearchRepository noteSearchRepository;

    public void indexNote(NoteEntity entity) {
        try {
            NoteDocument doc = toDocument(entity);
            noteSearchRepository.save(doc);
            log.debug("Indexed note {} in Elasticsearch", entity.getId());
        } catch (Exception e) {
            log.warn("Failed to index note {} in Elasticsearch: {}", entity.getId(), e.getMessage());
        }
    }

    public void removeNote(String noteId, String userId) {
        try {
            noteSearchRepository.deleteById(noteId);
            log.debug("Removed note {} from Elasticsearch", noteId);
        } catch (Exception e) {
            log.warn("Failed to remove note {} from Elasticsearch: {}", noteId, e.getMessage());
        }
    }

    public void deleteByUserAndId(String noteId, String userId) {
        try {
            noteSearchRepository.deleteByUserIdAndId(userId, noteId);
            log.debug("Deleted note {} from Elasticsearch", noteId);
        } catch (Exception e) {
            log.warn("Failed to delete note {} from Elasticsearch: {}", noteId, e.getMessage());
        }
    }

    private NoteDocument toDocument(NoteEntity entity) {
        NoteDocument doc = new NoteDocument();
        doc.setId(entity.getId());
        doc.setUserId(entity.getUserId());
        doc.setTitle(entity.getTitle());
        doc.setContent(entity.getContent());
        doc.setContentPlain(entity.getContentPlain());
        doc.setTags(entity.getTags());
        doc.setNotebookId(entity.getNotebookId());
        doc.setPinned(entity.isPinned());
        doc.setFavorite(entity.isFavorite());
        doc.setDeleted(entity.isDeleted());
        doc.setWordCount(entity.getWordCount());
        doc.setVersion(entity.getVersion());
        doc.setCreatedAt(entity.getCreatedAt().toEpochSecond(ZoneOffset.UTC) * 1000 + "");
        doc.setUpdatedAt(entity.getUpdatedAt().toEpochSecond(ZoneOffset.UTC) * 1000 + "");
        return doc;
    }
}
