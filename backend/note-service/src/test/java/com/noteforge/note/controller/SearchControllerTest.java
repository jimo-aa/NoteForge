package com.noteforge.note.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.noteforge.note.dto.NoteCreateRequest;
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

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SearchControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private NoteRepository noteRepository;

    private final String userId = "search-test-user";
    private final String authHeader = "Bearer test-token";

    @BeforeEach
    void setUp() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userId, null, Collections.emptyList()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        noteRepository.deleteAll();
    }

    @Test
    void globalSearch_shouldReturnMatchingNotes() throws Exception {
        // Create a note first
        NoteCreateRequest request = new NoteCreateRequest();
        request.setTitle("Searchable Note");
        request.setContent("This is a searchable content for testing");
        request.setNotebookId(null);

        mockMvc.perform(post("/api/v1/notes")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // Search for it
        mockMvc.perform(get("/api/v1/search")
                        .header("Authorization", authHeader)
                        .param("q", "Searchable"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.items").isArray());
    }

    @Test
    void globalSearch_shouldReturnEmpty_whenNoMatch() throws Exception {
        mockMvc.perform(get("/api/v1/search")
                        .header("Authorization", authHeader)
                        .param("q", "nonexistent-keyword-xyz"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.items", hasSize(0)));
    }
}
