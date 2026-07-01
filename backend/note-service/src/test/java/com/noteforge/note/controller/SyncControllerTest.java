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

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
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
}
