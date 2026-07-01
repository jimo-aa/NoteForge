package com.noteforge.note.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.noteforge.note.dto.VersionCreateRequest;
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
class VersionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private final String userId = "version-test-user";
    private final String authHeader = "Bearer test-token";

    @BeforeEach
    void setUp() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userId, null, Collections.emptyList()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void listVersions_shouldReturnEmpty_whenNoVersions() throws Exception {
        mockMvc.perform(get("/api/v1/notes/non-existent-id/versions")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data", hasSize(0)));
    }

    @Test
    void createVersion_shouldReturnCreatedVersion() throws Exception {
        VersionCreateRequest request = new VersionCreateRequest();
        request.setTitle("v1 title");
        request.setContent("# Hello");
        request.setContentPlain("Hello");

        mockMvc.perform(post("/api/v1/notes/test-note-id/versions")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.versionNumber", is(1)))
                .andExpect(jsonPath("$.data.title", is("v1 title")))
                .andExpect(jsonPath("$.data.noteId", is("test-note-id")));
    }

    @Test
    void createAndListVersions_shouldReturnAll() throws Exception {
        // Create first version
        VersionCreateRequest v1 = new VersionCreateRequest();
        v1.setTitle("v1");
        v1.setContent("content 1");
        v1.setContentPlain("content 1");

        mockMvc.perform(post("/api/v1/notes/test-note-v2/versions")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(v1)))
                .andExpect(status().isOk());

        // Create second version
        VersionCreateRequest v2 = new VersionCreateRequest();
        v2.setTitle("v2");
        v2.setContent("content 2");
        v2.setContentPlain("content 2");

        mockMvc.perform(post("/api/v1/notes/test-note-v2/versions")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(v2)))
                .andExpect(status().isOk());

        // List versions — should have 2, newest first (v2, v1)
        mockMvc.perform(get("/api/v1/notes/test-note-v2/versions")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data", hasSize(2)))
                .andExpect(jsonPath("$.data[0].versionNumber", is(2)))
                .andExpect(jsonPath("$.data[1].versionNumber", is(1)));
    }

    @Test
    void getVersion_shouldReturnSpecificVersion() throws Exception {
        // Create a version
        VersionCreateRequest v1 = new VersionCreateRequest();
        v1.setTitle("get-test");
        v1.setContent("content");
        v1.setContentPlain("content");

        mockMvc.perform(post("/api/v1/notes/get-test-note/versions")
                        .header("Authorization", authHeader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(v1)))
                .andExpect(status().isOk());

        // Get version 1
        mockMvc.perform(get("/api/v1/notes/get-test-note/versions/1")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.versionNumber", is(1)))
                .andExpect(jsonPath("$.data.title", is("get-test")));
    }

    @Test
    void getVersion_shouldReturn404_whenNotFound() throws Exception {
        mockMvc.perform(get("/api/v1/notes/unknown-note/versions/999")
                        .header("Authorization", authHeader))
                .andExpect(status().isNotFound());
    }
}
