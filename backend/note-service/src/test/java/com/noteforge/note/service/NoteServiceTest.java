package com.noteforge.note.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.noteforge.note.dto.NoteCreateRequest;
import com.noteforge.note.dto.NoteResponse;
import com.noteforge.note.dto.NoteUpdateRequest;
import com.noteforge.note.entity.NoteEntity;
import com.noteforge.note.entity.NoteLinkEntity;
import com.noteforge.note.entity.NoteVersionEntity;
import com.noteforge.note.entity.SyncLogEntity;
import com.noteforge.note.exception.ResourceNotFoundException;
import com.noteforge.note.repository.NoteLinkRepository;
import com.noteforge.note.repository.NoteRepository;
import com.noteforge.note.repository.NoteVersionRepository;
import com.noteforge.note.repository.SyncLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NoteServiceTest {

    @Mock
    private NoteRepository noteRepository;

    @Mock
    private NoteLinkRepository noteLinkRepository;

    @Mock
    private NoteVersionRepository noteVersionRepository;

    @Mock
    private SyncLogRepository syncLogRepository;

    @Mock
    private SyncNotificationService syncNotificationService;

    @Mock
    private AuditService auditService;

    private ObjectMapper objectMapper;
    private NoteService noteService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        noteService = new NoteService(noteRepository, noteLinkRepository, noteVersionRepository,
                syncLogRepository, syncNotificationService, auditService, objectMapper);
    }

    private NoteEntity createTestEntity(String id, String userId, String title, String content) {
        NoteEntity entity = new NoteEntity();
        entity.setId(id);
        entity.setUserId(userId);
        entity.setTitle(title);
        entity.setContent(content);
        entity.setContentPlain(content.replaceAll("<[^>]*>", ""));
        entity.setVersion(1);
        entity.setDeleted(false);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        return entity;
    }

    @Test
    void createNote_shouldCreateWithRequiredFields() {
        String userId = "user-1";
        NoteCreateRequest req = new NoteCreateRequest();
        req.setTitle("Test Note");
        req.setContent("<p>Hello</p>");

        when(noteRepository.save(any(NoteEntity.class))).thenAnswer(invocation -> {
            NoteEntity saved = invocation.getArgument(0);
            saved.setId("note-1");
            if (saved.getCreatedAt() == null) saved.setCreatedAt(LocalDateTime.now());
            if (saved.getUpdatedAt() == null) saved.setUpdatedAt(LocalDateTime.now());
            return saved;
        });

        NoteResponse response = noteService.createNote(userId, req);

        assertThat(response).isNotNull();
        assertThat(response.getTitle()).isEqualTo("Test Note");
        assertThat(response.getContent()).isEqualTo("<p>Hello</p>");

        verify(syncLogRepository).save(any(SyncLogEntity.class));
        verify(syncNotificationService).notifyNoteChanged(eq(userId), anyString(), anyString(), anyLong());
        verify(auditService).record(eq(userId), eq("CREATE"), eq("NOTE"), anyString(), anyString());
    }

    @Test
    void createNote_shouldSetDefaultContent_whenNull() {
        String userId = "user-1";
        NoteCreateRequest req = new NoteCreateRequest();
        req.setTitle("Empty Note");

        when(noteRepository.save(any(NoteEntity.class))).thenAnswer(invocation -> {
            NoteEntity saved = invocation.getArgument(0);
            saved.setId("note-2");
            if (saved.getCreatedAt() == null) saved.setCreatedAt(LocalDateTime.now());
            if (saved.getUpdatedAt() == null) saved.setUpdatedAt(LocalDateTime.now());
            return saved;
        });

        NoteResponse response = noteService.createNote(userId, req);

        assertThat(response.getContent()).isEqualTo("");
        assertThat(response.getWordCount()).isEqualTo(0);
    }

    @Test
    void getNote_shouldReturnNote_whenExists() {
        NoteEntity entity = createTestEntity("note-1", "user-1", "Test Note", "Content");
        when(noteRepository.findById("note-1")).thenReturn(Optional.of(entity));

        NoteResponse response = noteService.getNote("note-1", "user-1");

        assertThat(response).isNotNull();
        assertThat(response.getId()).isEqualTo("note-1");
        assertThat(response.getTitle()).isEqualTo("Test Note");
    }

    @Test
    void getNote_shouldThrow_whenNotFound() {
        when(noteRepository.findById("nonexistent")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> noteService.getNote("nonexistent", "user-1"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Note not found");
    }

    @Test
    void getNote_shouldThrow_whenDeleted() {
        NoteEntity entity = createTestEntity("note-1", "user-1", "Deleted Note", "Content");
        entity.setDeleted(true);
        when(noteRepository.findById("note-1")).thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> noteService.getNote("note-1", "user-1"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Note not found");
    }

    @Test
    void getNote_shouldThrow_whenWrongUser() {
        NoteEntity entity = createTestEntity("note-1", "other-user", "Test Note", "Content");
        when(noteRepository.findById("note-1")).thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> noteService.getNote("note-1", "user-1"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Note not found");
    }

    @Test
    void updateNote_shouldUpdateFields() {
        NoteEntity entity = createTestEntity("note-1", "user-1", "Original", "<p>Original</p>");
        entity.setVersion(1);
        when(noteRepository.findById("note-1")).thenReturn(Optional.of(entity));
        when(noteRepository.save(any(NoteEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        NoteUpdateRequest req = new NoteUpdateRequest();
        req.setTitle("Updated Title");
        req.setContent("<p>Updated Content</p>");
        req.setIsFavorite(true);

        NoteResponse response = noteService.updateNote("note-1", "user-1", req);

        assertThat(response.getTitle()).isEqualTo("Updated Title");
        assertThat(response.getContent()).isEqualTo("<p>Updated Content</p>");
        assertThat(entity.getVersion()).isEqualTo(2);

        verify(noteVersionRepository).save(any(NoteVersionEntity.class));
        verify(syncLogRepository).save(any(SyncLogEntity.class));
    }

    @Test
    void updateNote_shouldThrow_whenNotFound() {
        when(noteRepository.findById("nonexistent")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> noteService.updateNote("nonexistent", "user-1", new NoteUpdateRequest()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void deleteNote_shouldMarkAsDeleted() {
        NoteEntity entity = createTestEntity("note-1", "user-1", "To Delete", "Content");
        when(noteRepository.findById("note-1")).thenReturn(Optional.of(entity));

        noteService.deleteNote("note-1", "user-1");

        assertThat(entity.isDeleted()).isTrue();
        verify(noteRepository).save(entity);
        verify(syncLogRepository).save(any(SyncLogEntity.class));
        verify(syncNotificationService).notifyNoteDeleted("user-1", "note-1");
    }

    @Test
    void listNotes_shouldReturnNotesForUser() {
        NoteEntity entity1 = createTestEntity("n1", "user-1", "Note 1", "Content 1");
        NoteEntity entity2 = createTestEntity("n2", "user-1", "Note 2", "Content 2");
        Page<NoteEntity> page = new PageImpl<>(List.of(entity1, entity2));

        when(noteRepository.findByUserIdAndIsDeletedFalse(eq("user-1"), any(PageRequest.class)))
                .thenReturn(page);

        List<NoteResponse> notes = noteService.listNotes("user-1", null, 0, 20);

        assertThat(notes).hasSize(2);
        assertThat(notes.get(0).getTitle()).isEqualTo("Note 1");
    }

    @Test
    void listNotes_shouldFilterByNotebook() {
        when(noteRepository.findByUserIdAndNotebookIdAndIsDeletedFalse(
                anyString(), anyString(), any(PageRequest.class)))
                .thenReturn(Page.empty());

        List<NoteResponse> notes = noteService.listNotes("user-1", "notebook-1", 0, 20);

        assertThat(notes).isEmpty();
        verify(noteRepository).findByUserIdAndNotebookIdAndIsDeletedFalse(
                "user-1", "notebook-1", PageRequest.of(0, 20));
    }

    @Test
    void getBacklinks_shouldReturnOnlyOwnedNonDeletedSources() {
        NoteLinkEntity link = new NoteLinkEntity();
        link.setSourceNoteId("source-1");
        link.setTargetNoteId("target-1");
        link.setUserId("user-1");

        NoteEntity source = createTestEntity("source-1", "user-1", "Source Note", "Content");

        when(noteLinkRepository.findByTargetNoteIdAndUserId("target-1", "user-1"))
                .thenReturn(List.of(link));
        when(noteRepository.findById("source-1")).thenReturn(Optional.of(source));

        var backlinks = noteService.getBacklinks("target-1", "user-1");

        assertThat(backlinks).hasSize(1);
        assertThat(backlinks.get(0).getTitle()).isEqualTo("Source Note");
    }

    @Test
    void getBacklinks_shouldExcludeDeletedSources() {
        NoteLinkEntity link = new NoteLinkEntity();
        link.setSourceNoteId("deleted-source");
        link.setTargetNoteId("target-1");
        link.setUserId("user-1");

        NoteEntity source = createTestEntity("deleted-source", "user-1", "Deleted Source", "Content");
        source.setDeleted(true);

        when(noteLinkRepository.findByTargetNoteIdAndUserId("target-1", "user-1"))
                .thenReturn(List.of(link));
        when(noteRepository.findById("deleted-source")).thenReturn(Optional.of(source));

        var backlinks = noteService.getBacklinks("target-1", "user-1");

        assertThat(backlinks).isEmpty();
    }

    @Test
    void searchNotes_shouldFallbackToLikeQuery_whenFullTextFails() {
        when(noteRepository.searchByFullText(anyString(), anyString(), any(PageRequest.class)))
                .thenThrow(new RuntimeException("to_tsvector not available"));
        when(noteRepository.searchByLike(anyString(), anyString(), any(PageRequest.class)))
                .thenReturn(Page.empty());

        Page<NoteResponse> result = noteService.searchNotes("user-1", "query", 0, 20);

        assertThat(result).isEmpty();
        verify(noteRepository).searchByLike("user-1", "query", PageRequest.of(0, 20));
    }
}
