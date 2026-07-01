package com.noteforge.note.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.noteforge.note.entity.NotebookEntity;
import com.noteforge.note.repository.NotebookRepository;
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
class NotebookControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private NotebookRepository notebookRepository;

    private final String userId = "notebook-test-user";
    private final String authHeader = "Bearer test-token";

    @BeforeEach
    void setUp() {
        notebookRepository.deleteAll();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userId, null, Collections.emptyList()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void createNotebook_shouldReturnCreatedNotebook() throws Exception {
        mockMvc.perform(post("/api/v1/notebooks")
                        .header("Authorization", authHeader)
                        .param("name", "My Notebook")
                        .param("icon", "\uD83D\uDCDA")
                        .param("color", "#ff0000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.name", is("My Notebook")))
                .andExpect(jsonPath("$.data.color", is("#ff0000")))
                .andExpect(jsonPath("$.data.userId", is(userId)));
    }

    @Test
    void listNotebooks_shouldReturnEmpty_whenNoneExist() throws Exception {
        mockMvc.perform(get("/api/v1/notebooks")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data", hasSize(0)));
    }

    @Test
    void listNotebooks_shouldReturnUserNotebooksOnly() throws Exception {
        NotebookEntity entity = new NotebookEntity();
        entity.setUserId(userId);
        entity.setName("My Notebook");
        entity.setIcon("\uD83D\uDCC1");
        notebookRepository.save(entity);

        // Another user's notebook (should not appear)
        NotebookEntity other = new NotebookEntity();
        other.setUserId("other-user");
        other.setName("Other's Notebook");
        notebookRepository.save(other);

        mockMvc.perform(get("/api/v1/notebooks")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].name", is("My Notebook")));
    }

    @Test
    void renameNotebook_shouldUpdateName() throws Exception {
        NotebookEntity entity = new NotebookEntity();
        entity.setUserId(userId);
        entity.setName("Old Name");
        notebookRepository.save(entity);

        mockMvc.perform(put("/api/v1/notebooks/{id}", entity.getId())
                        .header("Authorization", authHeader)
                        .param("name", "New Name"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.name", is("New Name")));
    }

    @Test
    void deleteNotebook_shouldSoftDelete() throws Exception {
        NotebookEntity entity = new NotebookEntity();
        entity.setUserId(userId);
        entity.setName("To Delete");
        notebookRepository.save(entity);

        mockMvc.perform(delete("/api/v1/notebooks/{id}", entity.getId())
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)));

        // Should no longer appear in list
        mockMvc.perform(get("/api/v1/notebooks")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(0)));
    }

    @Test
    void reorderNotebooks_shouldAcceptOrderedIds() throws Exception {
        NotebookEntity a = new NotebookEntity();
        a.setUserId(userId);
        a.setName("A");
        a.setSortOrder(0);
        notebookRepository.save(a);

        NotebookEntity b = new NotebookEntity();
        b.setUserId(userId);
        b.setName("B");
        b.setSortOrder(1);
        notebookRepository.save(b);

        mockMvc.perform(put("/api/v1/notebooks/reorder")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(List.of(b.getId(), a.getId()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)));
    }
}
