package com.noteforge.note.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.noteforge.note.dto.NoteCreateRequest;
import com.noteforge.note.dto.NoteUpdateRequest;
import com.noteforge.note.entity.NoteEntity;
import com.noteforge.note.repository.NoteRepository;
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

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NoteControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private NoteRepository noteRepository;

    private String userId = "test-user-id";
    private String authHeader;

    @BeforeEach
    void setUp() {
        noteRepository.deleteAll();
        // Use a fixed user ID; JWT validation is bypassed in test profile
        authHeader = "Bearer test-token";
        // Set explicit authentication so auth.getName() returns the test userId
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userId, null, Collections.emptyList()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void createNote_shouldReturnCreatedNote() throws Exception {
        NoteCreateRequest request = new NoteCreateRequest();
        request.setTitle("Test Note");
        request.setContent("Hello World");
        request.setTags(List.of("tag1", "tag2"));

        mockMvc.perform(post("/api/v1/notes")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.title", is("Test Note")))
                .andExpect(jsonPath("$.data.tags", hasSize(2)));
    }

    @Test
    void getNote_shouldReturnNote() throws Exception {
        NoteEntity entity = new NoteEntity();
        entity.setUserId(userId);
        entity.setTitle("Existing Note");
        entity.setContent("Some content");
        noteRepository.save(entity);

        mockMvc.perform(get("/api/v1/notes/{id}", entity.getId())
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.title", is("Existing Note")));
    }

    @Test
    void getNote_shouldReturn404_whenNotFound() throws Exception {
        mockMvc.perform(get("/api/v1/notes/non-existent-id")
                        .header("Authorization", authHeader))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void updateNote_shouldModifyFields() throws Exception {
        NoteEntity entity = new NoteEntity();
        entity.setUserId(userId);
        entity.setTitle("Original Title");
        entity.setContent("Original content");
        noteRepository.save(entity);

        NoteUpdateRequest update = new NoteUpdateRequest();
        update.setTitle("Updated Title");
        update.setIsFavorite(true);

        mockMvc.perform(put("/api/v1/notes/{id}", entity.getId())
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(update)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title", is("Updated Title")))
                .andExpect(jsonPath("$.data.favorite", is(true)));
    }

    @Test
    void deleteNote_shouldSoftDelete() throws Exception {
        NoteEntity entity = new NoteEntity();
        entity.setUserId(userId);
        entity.setTitle("To Delete");
        entity.setContent("Content");
        noteRepository.save(entity);

        mockMvc.perform(delete("/api/v1/notes/{id}", entity.getId())
                        .header("Authorization", authHeader))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/notes/{id}", entity.getId())
                        .header("Authorization", authHeader))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void listNotes_shouldReturnPaginatedResults() throws Exception {
        for (int i = 0; i < 5; i++) {
            NoteEntity entity = new NoteEntity();
            entity.setUserId(userId);
            entity.setTitle("Note " + i);
            entity.setContent("Content " + i);
            noteRepository.save(entity);
        }

        mockMvc.perform(get("/api/v1/notes")
                        .header("Authorization", authHeader)
                        .param("page", "0")
                        .param("size", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.items", hasSize(3)));
    }

    @Test
    void searchNotes_shouldReturnMatchingResults() throws Exception {
        NoteEntity entity = new NoteEntity();
        entity.setUserId(userId);
        entity.setTitle("UniqueSearchableTitle");
        entity.setContent("Some content");
        entity.setContentPlain("Some content");
        noteRepository.save(entity);

        mockMvc.perform(get("/api/v1/notes/search")
                        .header("Authorization", authHeader)
                        .param("q", "UniqueSearchableTitle"))
                .andExpect(status().isOk());
    }
}
