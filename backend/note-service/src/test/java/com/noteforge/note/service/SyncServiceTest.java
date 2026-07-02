package com.noteforge.note.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.noteforge.note.dto.*;
import com.noteforge.note.entity.NoteEntity;
import com.noteforge.note.entity.SyncLogEntity;
import com.noteforge.note.repository.NoteRepository;
import com.noteforge.note.repository.SyncLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SyncServiceTest {

    @Mock
    private SyncLogRepository syncLogRepository;

    @Mock
    private NoteRepository noteRepository;

    @Mock
    private SyncNotificationService syncNotificationService;

    private ObjectMapper objectMapper;
    private SyncService syncService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        syncService = new SyncService(syncLogRepository, noteRepository,
                syncNotificationService, objectMapper);
    }

    private NoteEntity createNote(String id, String userId, String title, String content, int version, boolean deleted) {
        NoteEntity entity = new NoteEntity();
        entity.setId(id);
        entity.setUserId(userId);
        entity.setTitle(title);
        entity.setContent(content);
        entity.setContentPlain(content.replaceAll("<[^>]*>", ""));
        entity.setVersion(version);
        entity.setDeleted(deleted);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        return entity;
    }

    @Test
    void getSyncState_shouldReturnZero_whenNoLogs() {
        when(syncLogRepository.findByUserIdAndVersionGreaterThanOrderByVersionAsc(anyString(), anyLong()))
                .thenReturn(List.of());

        SyncStateResponse state = syncService.getSyncState("user-1");

        assertThat(state.getLastSyncVersion()).isEqualTo(0);
        assertThat(state.getPendingChanges()).isEqualTo(0);
    }

    @Test
    void getSyncState_shouldReturnMaxVersion() {
        SyncLogEntity log1 = new SyncLogEntity();
        log1.setVersion(100);
        SyncLogEntity log2 = new SyncLogEntity();
        log2.setVersion(200);

        when(syncLogRepository.findByUserIdAndVersionGreaterThanOrderByVersionAsc("user-1", 0L))
                .thenReturn(List.of(log1, log2));

        SyncStateResponse state = syncService.getSyncState("user-1");

        assertThat(state.getLastSyncVersion()).isEqualTo(200);
    }

    @Test
    void pullChanges_shouldReturnOnlyNonDeletedNotes() {
        NoteEntity alive = createNote("note-1", "user-1", "Alive", "Content", 1, false);
        NoteEntity deleted = createNote("note-2", "user-1", "Deleted", "Content", 1, true);

        when(noteRepository.findByUserIdAndUpdatedAtAfterOrderByUpdatedAtAsc(eq("user-1"), any(LocalDateTime.class)))
                .thenReturn(List.of(alive, deleted));
        when(syncLogRepository.findByUserIdAndVersionGreaterThanOrderByVersionAsc(anyString(), anyLong()))
                .thenReturn(List.of());

        SyncPullResponse response = syncService.pullChanges("user-1", 0L);

        assertThat(response.getNotes()).hasSize(1);
        assertThat(response.getNotes().get(0).getId()).isEqualTo("note-1");
        assertThat(response.getDeletedNoteIds()).containsExactly("note-2");
    }

    @Test
    void pullChanges_shouldReturnEmpty_whenNoChanges() {
        when(noteRepository.findByUserIdAndUpdatedAtAfterOrderByUpdatedAtAsc(eq("user-1"), any(LocalDateTime.class)))
                .thenReturn(List.of());
        when(syncLogRepository.findByUserIdAndVersionGreaterThanOrderByVersionAsc(anyString(), anyLong()))
                .thenReturn(List.of());

        SyncPullResponse response = syncService.pullChanges("user-1", System.currentTimeMillis());

        assertThat(response.getNotes()).isEmpty();
        assertThat(response.getDeletedNoteIds()).isEmpty();
    }

    @Test
    void pushChanges_shouldCreateNewNote() {
        SyncPushRequest request = new SyncPushRequest();
        SyncPushRequest.SyncChangeItem item = new SyncPushRequest.SyncChangeItem();
        item.setNoteId("sync-new-note");
        item.setTitle("Sync Created");
        item.setContent("<p>Created via sync</p>");
        item.setClientVersion(0);
        request.setChanges(List.of(item));

        when(noteRepository.findById("sync-new-note")).thenReturn(Optional.empty());
        when(noteRepository.save(any(NoteEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        SyncPushResponse response = syncService.pushChanges("user-1", request);

        assertThat(response.getAccepted()).isEqualTo(1);
        assertThat(response.getConflicts()).isEmpty();

        ArgumentCaptor<NoteEntity> captor = ArgumentCaptor.forClass(NoteEntity.class);
        verify(noteRepository).save(captor.capture());
        NoteEntity saved = captor.getValue();
        assertThat(saved.getId()).isEqualTo("sync-new-note");
        assertThat(saved.getUserId()).isEqualTo("user-1");
        assertThat(saved.getTitle()).isEqualTo("Sync Created");
        assertThat(saved.getVersion()).isEqualTo(1);
    }

    @Test
    void pushChanges_shouldUpdateExistingNote() {
        NoteEntity existing = createNote("existing-note", "user-1", "Old Title", "<p>Old</p>", 1, false);

        SyncPushRequest request = new SyncPushRequest();
        SyncPushRequest.SyncChangeItem item = new SyncPushRequest.SyncChangeItem();
        item.setNoteId("existing-note");
        item.setClientVersion(1);
        item.setTitle("New Title");
        item.setContent("<p>New</p>");
        request.setChanges(List.of(item));

        when(noteRepository.findById("existing-note")).thenReturn(Optional.of(existing));
        when(noteRepository.save(any(NoteEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        SyncPushResponse response = syncService.pushChanges("user-1", request);

        assertThat(response.getAccepted()).isEqualTo(1);
        assertThat(existing.getTitle()).isEqualTo("New Title");
        assertThat(existing.getContent()).isEqualTo("<p>New</p>");
        assertThat(existing.getVersion()).isEqualTo(2);
    }

    @Test
    void pushChanges_shouldDetectConflicts() {
        NoteEntity existing = createNote("conflict-note", "user-1", "Original", "Content", 3, false);

        SyncPushRequest request = new SyncPushRequest();
        SyncPushRequest.SyncChangeItem item = new SyncPushRequest.SyncChangeItem();
        item.setNoteId("conflict-note");
        item.setClientVersion(1); // stale — server has version 3
        item.setTitle("Conflicting Update");
        request.setChanges(List.of(item));

        when(noteRepository.findById("conflict-note")).thenReturn(Optional.of(existing));

        SyncPushResponse response = syncService.pushChanges("user-1", request);

        assertThat(response.getAccepted()).isEqualTo(0);
        assertThat(response.getConflicts()).hasSize(1);
        assertThat(response.getConflicts().get(0).getNoteId()).isEqualTo("conflict-note");
    }

    @Test
    void pushChanges_shouldHandleDeletion() {
        NoteEntity existing = createNote("delete-note", "user-1", "To Delete", "Content", 1, false);

        SyncPushRequest request = new SyncPushRequest();
        SyncPushRequest.SyncChangeItem item = new SyncPushRequest.SyncChangeItem();
        item.setNoteId("delete-note");
        item.setClientVersion(1);
        item.setIsDeleted(true);
        request.setChanges(List.of(item));

        when(noteRepository.findById("delete-note")).thenReturn(Optional.of(existing));
        when(noteRepository.save(any(NoteEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        SyncPushResponse response = syncService.pushChanges("user-1", request);

        assertThat(response.getAccepted()).isEqualTo(1);
        assertThat(existing.isDeleted()).isTrue();
    }

    @Test
    void pushChanges_shouldSkipNoteOfAnotherUser() {
        NoteEntity otherUserNote = createNote("other-note", "other-user", "Other's Note", "Content", 1, false);

        SyncPushRequest request = new SyncPushRequest();
        SyncPushRequest.SyncChangeItem item = new SyncPushRequest.SyncChangeItem();
        item.setNoteId("other-note");
        item.setClientVersion(1);
        request.setChanges(List.of(item));

        when(noteRepository.findById("other-note")).thenReturn(Optional.of(otherUserNote));

        SyncPushResponse response = syncService.pushChanges("user-1", request);

        assertThat(response.getAccepted()).isEqualTo(0);
    }

    @Test
    void resolveConflicts_shouldReturnNotesWithMultipleLogEntries() {
        SyncLogEntity log1 = new SyncLogEntity();
        log1.setNoteId("conflict-note");
        log1.setVersion(10);
        SyncLogEntity log2 = new SyncLogEntity();
        log2.setNoteId("conflict-note");
        log2.setVersion(20);
        SyncLogEntity log3 = new SyncLogEntity();
        log3.setNoteId("peaceful-note");
        log3.setVersion(15);

        when(syncLogRepository.findByUserIdAndVersionGreaterThanOrderByVersionAsc("user-1", 5L))
                .thenReturn(List.of(log1, log2, log3));

        List<String> conflicted = syncService.resolveConflicts("user-1", 5L);

        assertThat(conflicted).hasSize(1);
        assertThat(conflicted.get(0)).isEqualTo("conflict-note");
    }
}
