package com.noteforge.note.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.noteforge.note.dto.SyncPullResponse;
import com.noteforge.note.dto.SyncPushRequest;
import com.noteforge.note.dto.SyncPushResponse;
import com.noteforge.note.entity.NoteEntity;
import com.noteforge.note.entity.SyncLogEntity;
import com.noteforge.note.repository.NoteRepository;
import com.noteforge.note.repository.SyncLogRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SyncControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private NoteRepository noteRepository;

    @Autowired
    private SyncLogRepository syncLogRepository;

    private final String userId = "test-sync-user";
    private final String authHeader = "Bearer test-token";

    @BeforeEach
    void setUp() {
        noteRepository.deleteAll();
        syncLogRepository.deleteAll();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userId, null, Collections.emptyList()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void pull_shouldReturnEmpty_whenNoNotes() throws Exception {
        mockMvc.perform(post("/api/v1/sync/pull")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("lastVersion", 0L))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.notes", hasSize(0)))
                .andExpect(jsonPath("$.data.serverVersion").exists())
                .andExpect(jsonPath("$.data.serverVersion").isNumber());
    }

    @Test
    void pull_shouldReturnNotes_withLastVersionZero() throws Exception {
        // Create two notes; lastVersion=0 should return both (epoch-based filter)
        NoteEntity note1 = new NoteEntity();
        note1.setUserId(userId);
        note1.setTitle("First Note");
        note1.setContent("Content 1");
        noteRepository.save(note1);

        NoteEntity note2 = new NoteEntity();
        note2.setUserId(userId);
        note2.setTitle("Second Note");
        note2.setContent("Content 2");
        noteRepository.save(note2);

        mockMvc.perform(post("/api/v1/sync/pull")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("lastVersion", 0L))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.notes", hasSize(2)))
                .andExpect(jsonPath("$.data.serverVersion").exists())
                .andExpect(jsonPath("$.data.serverVersion").isNumber());
    }

    @Test
    void push_shouldCreateNewNote() throws Exception {
        SyncPushRequest request = new SyncPushRequest();
        SyncPushRequest.SyncChangeItem item = new SyncPushRequest.SyncChangeItem();
        item.setNoteId("sync-push-test-note-1");
        item.setClientVersion(0);
        item.setTitle("Sync Created Note");
        item.setContent("<p>Created via sync push</p>");
        item.setTags(List.of("sync", "test"));
        request.setChanges(List.of(item));

        mockMvc.perform(post("/api/v1/sync/push")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.accepted", is(1)))
                .andExpect(jsonPath("$.data.conflicts", hasSize(0)));

        // Verify the note was created
        mockMvc.perform(get("/api/v1/notes/{id}", "sync-push-test-note-1")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title", is("Sync Created Note")));
    }

    @Test
    void push_shouldDetectConflicts() throws Exception {
        // First create a note with version 1
        NoteEntity entity = new NoteEntity();
        entity.setId("sync-conflict-note");
        entity.setUserId(userId);
        entity.setTitle("Original");
        entity.setContent("Original content");
        entity.setVersion(1);
        noteRepository.save(entity);

        // Push a change with clientVersion = 0 (stale — server has version 1)
        SyncPushRequest request = new SyncPushRequest();
        SyncPushRequest.SyncChangeItem item = new SyncPushRequest.SyncChangeItem();
        item.setNoteId("sync-conflict-note");
        item.setClientVersion(0);
        item.setTitle("Conflicting Update");
        request.setChanges(List.of(item));

        mockMvc.perform(post("/api/v1/sync/push")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.accepted", is(0)))
                .andExpect(jsonPath("$.data.conflicts", hasSize(1)))
                .andExpect(jsonPath("$.data.conflicts[0].noteId", is("sync-conflict-note")));
    }

    @Test
    void push_shouldUpdateExistingNote() throws Exception {
        // Create a note
        NoteEntity entity = new NoteEntity();
        entity.setId("sync-update-note");
        entity.setUserId(userId);
        entity.setTitle("Before Update");
        entity.setContent("<p>Old content</p>");
        entity.setVersion(1);
        noteRepository.save(entity);

        // Push an update with matching clientVersion
        SyncPushRequest request = new SyncPushRequest();
        SyncPushRequest.SyncChangeItem item = new SyncPushRequest.SyncChangeItem();
        item.setNoteId("sync-update-note");
        item.setClientVersion(1);
        item.setTitle("After Update");
        item.setContent("<p>New content</p>");
        item.setIsFavorite(true);
        request.setChanges(List.of(item));

        mockMvc.perform(post("/api/v1/sync/push")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.accepted", is(1)));

        // Verify the update
        mockMvc.perform(get("/api/v1/notes/{id}", "sync-update-note")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title", is("After Update")))
                .andExpect(jsonPath("$.data.favorite", is(true)));
    }

    @Test
    void getSyncState_shouldReturnCurrentState() throws Exception {
        // Create a note (which generates sync data indirectly)
        NoteEntity entity = new NoteEntity();
        entity.setUserId(userId);
        entity.setTitle("State Test Note");
        entity.setContent("Content");
        noteRepository.save(entity);

        // Create a sync log entry manually
        SyncLogEntity log = new SyncLogEntity();
        log.setNoteId(entity.getId());
        log.setUserId(userId);
        log.setOperation("CREATE");
        log.setVersion(100);
        syncLogRepository.save(log);

        mockMvc.perform(get("/api/v1/sync/state")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.lastSyncVersion").exists())
                .andExpect(jsonPath("$.data.lastSyncVersion").isNumber());
    }

    // ── E2E sync cycle tests ──────────────────────────────────────────

    @Test
    void syncCycle_pushThenPull_shouldReturnSameNotes() throws Exception {
        // Push 3 notes
        SyncPushRequest pushReq = new SyncPushRequest();
        List<SyncPushRequest.SyncChangeItem> changes = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            SyncPushRequest.SyncChangeItem item = new SyncPushRequest.SyncChangeItem();
            item.setNoteId("sync-cycle-note-" + i);
            item.setClientVersion(0);
            item.setTitle("Cycle Note " + i);
            item.setContent("<p>Content " + i + "</p>");
            item.setTags(List.of("cycle"));
            changes.add(item);
        }
        pushReq.setChanges(changes);

        String pushResp = mockMvc.perform(post("/api/v1/sync/push")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pushReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accepted", is(3)))
                .andReturn().getResponse().getContentAsString();

        long serverVersion = objectMapper.readTree(pushResp).get("data").get("serverVersion").asLong();

        // Pull with lastVersion=0 should return all 3
        mockMvc.perform(post("/api/v1/sync/pull")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("lastVersion", 0L))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.notes", hasSize(3)))
                .andExpect(jsonPath("$.data.serverVersion").value(greaterThanOrEqualTo(serverVersion)));
    }

    @Test
    void syncCycle_incrementalPull_shouldOnlyReturnNewNotes() throws Exception {
        // Create note with version 1 via noteRepository (simulates earlier sync)
        NoteEntity earlier = new NoteEntity();
        earlier.setId("earlier-note");
        earlier.setUserId(userId);
        earlier.setTitle("Earlier Note");
        earlier.setContent("Earlier");
        earlier.setVersion(1);
        noteRepository.save(earlier);

        long beforePush = System.currentTimeMillis();

        // Push a new note
        SyncPushRequest pushReq = new SyncPushRequest();
        SyncPushRequest.SyncChangeItem item = new SyncPushRequest.SyncChangeItem();
        item.setNoteId("newer-note");
        item.setClientVersion(0);
        item.setTitle("Newer Note");
        item.setContent("<p>Newer</p>");
        pushReq.setChanges(List.of(item));

        mockMvc.perform(post("/api/v1/sync/push")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pushReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accepted", is(1)));

        // Pull with lastVersion = beforePush should only return the newer note
        mockMvc.perform(post("/api/v1/sync/pull")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("lastVersion", beforePush))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.notes", hasSize(1)))
                .andExpect(jsonPath("$.data.notes[0].id", is("newer-note")));
    }

    @Test
    void syncCycle_pushDeletion_shouldReturnDeletedIds() throws Exception {
        // Create a note via sync
        SyncPushRequest pushReq = new SyncPushRequest();
        SyncPushRequest.SyncChangeItem create = new SyncPushRequest.SyncChangeItem();
        create.setNoteId("delete-me-note");
        create.setClientVersion(0);
        create.setTitle("To Delete");
        create.setContent("<p>Will be deleted</p>");
        pushReq.setChanges(List.of(create));

        mockMvc.perform(post("/api/v1/sync/push")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pushReq)))
                .andExpect(status().isOk());

        // Push a delete for the same note
        SyncPushRequest deleteReq = new SyncPushRequest();
        SyncPushRequest.SyncChangeItem delete = new SyncPushRequest.SyncChangeItem();
        delete.setNoteId("delete-me-note");
        delete.setClientVersion(1);
        delete.setIsDeleted(true);
        deleteReq.setChanges(List.of(delete));

        String deleteResp = mockMvc.perform(post("/api/v1/sync/push")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(deleteReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accepted", is(1)))
                .andReturn().getResponse().getContentAsString();

        long serverVersion = objectMapper.readTree(deleteResp).get("data").get("serverVersion").asLong();

        // Pull should return deletedIds
        mockMvc.perform(post("/api/v1/sync/pull")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("lastVersion", 0L))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.deletedNoteIds", hasItem("delete-me-note")))
                .andExpect(jsonPath("$.data.serverVersion").value(greaterThanOrEqualTo(serverVersion)));

        // The note should not appear in the regular notes list
        mockMvc.perform(get("/api/v1/notes/{id}", "delete-me-note")
                        .header("Authorization", authHeader))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void syncCycle_batchPush_shouldHandleMixedUpdates() throws Exception {
        // Create one note locally
        NoteEntity existing = new NoteEntity();
        existing.setId("existing-note");
        existing.setUserId(userId);
        existing.setTitle("Existing");
        existing.setContent("Existing content");
        existing.setVersion(2);
        noteRepository.save(existing);

        // Batch: update existing, create two new, one with stale version (conflict)
        SyncPushRequest request = new SyncPushRequest();
        List<SyncPushRequest.SyncChangeItem> changes = new ArrayList<>();

        SyncPushRequest.SyncChangeItem updateExisting = new SyncPushRequest.SyncChangeItem();
        updateExisting.setNoteId("existing-note");
        updateExisting.setClientVersion(2);
        updateExisting.setTitle("Updated Existing");
        updateExisting.setIsFavorite(true);
        changes.add(updateExisting);

        SyncPushRequest.SyncChangeItem newNote = new SyncPushRequest.SyncChangeItem();
        newNote.setNoteId("batch-new-note");
        newNote.setClientVersion(0);
        newNote.setTitle("Batch New");
        newNote.setContent("<p>Batch created</p>");
        changes.add(newNote);

        SyncPushRequest.SyncChangeItem staleUpdate = new SyncPushRequest.SyncChangeItem();
        staleUpdate.setNoteId("existing-note");
        staleUpdate.setClientVersion(1); // stale — server has 2
        staleUpdate.setTitle("Stale Update");
        changes.add(staleUpdate);

        request.setChanges(changes);

        mockMvc.perform(post("/api/v1/sync/push")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.accepted", is(2))) // existing update + new note
                .andExpect(jsonPath("$.data.conflicts", hasSize(1)))
                .andExpect(jsonPath("$.data.conflicts[0].noteId", is("existing-note")));
    }

    @Test
    void syncCycle_multiUserIsolation_shouldNotLeakNotes() throws Exception {
        // Create a note for another user
        NoteEntity otherNote = new NoteEntity();
        otherNote.setId("other-user-note");
        otherNote.setUserId("other-user");
        otherNote.setTitle("Other's Note");
        otherNote.setContent("Secret");
        noteRepository.save(otherNote);

        // Push a note as current user
        SyncPushRequest pushReq = new SyncPushRequest();
        SyncPushRequest.SyncChangeItem item = new SyncPushRequest.SyncChangeItem();
        item.setNoteId("my-sync-note");
        item.setClientVersion(0);
        item.setTitle("My Note");
        pushReq.setChanges(List.of(item));

        mockMvc.perform(post("/api/v1/sync/push")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pushReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accepted", is(1)));

        // Pull should only return current user's notes, not "other-user-note"
        mockMvc.perform(post("/api/v1/sync/pull")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("lastVersion", 0L))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.notes", hasSize(1)))
                .andExpect(jsonPath("$.data.notes[0].id", is("my-sync-note")));
    }

    @Test
    void syncCycle_pushWithAllFields_shouldSyncCorrectly() throws Exception {
        SyncPushRequest request = new SyncPushRequest();
        SyncPushRequest.SyncChangeItem item = new SyncPushRequest.SyncChangeItem();
        item.setNoteId("all-fields-note");
        item.setClientVersion(0);
        item.setTitle("All Fields");
        item.setContent("<p>Rich content</p>");
        item.setNotebookId("notebook-1");
        item.setTags(List.of("tag-a", "tag-b"));
        item.setIsPinned(true);
        item.setIsFavorite(true);
        item.setIsDeleted(false);
        request.setChanges(List.of(item));

        String resp = mockMvc.perform(post("/api/v1/sync/push")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accepted", is(1)))
                .andReturn().getResponse().getContentAsString();

        // Verify via direct fetch
        mockMvc.perform(get("/api/v1/notes/{id}", "all-fields-note")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title", is("All Fields")))
                .andExpect(jsonPath("$.data.notebookId", is("notebook-1")))
                .andExpect(jsonPath("$.data.tags", hasItems("tag-a", "tag-b")))
                .andExpect(jsonPath("$.data.pinned", is(true)))
                .andExpect(jsonPath("$.data.favorite", is(true)));
    }

    @Test
    void resolveConflicts_shouldReturnConflictedNotes() throws Exception {
        // Create multiple sync log entries for the same note
        SyncLogEntity log1 = new SyncLogEntity();
        log1.setNoteId("conflict-note");
        log1.setUserId(userId);
        log1.setOperation("UPDATE");
        log1.setVersion(10);
        syncLogRepository.save(log1);

        SyncLogEntity log2 = new SyncLogEntity();
        log2.setNoteId("conflict-note");
        log2.setUserId(userId);
        log2.setOperation("UPDATE");
        log2.setVersion(20);
        syncLogRepository.save(log2);

        // A different note with single log entry (no conflict)
        SyncLogEntity log3 = new SyncLogEntity();
        log3.setNoteId("peaceful-note");
        log3.setUserId(userId);
        log3.setOperation("UPDATE");
        log3.setVersion(15);
        syncLogRepository.save(log3);

        mockMvc.perform(get("/api/v1/sync/conflicts")
                        .header("Authorization", authHeader)
                        .param("clientVersion", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0]", is("conflict-note")));
    }
}
