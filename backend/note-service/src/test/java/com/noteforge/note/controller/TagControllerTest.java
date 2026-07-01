package com.noteforge.note.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.noteforge.note.entity.TagEntity;
import com.noteforge.note.repository.TagRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
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
class TagControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TagRepository tagRepository;

    private final String userId = "tag-test-user";
    private final String authHeader = "Bearer test-token";

    @BeforeEach
    void setUp() {
        tagRepository.deleteAll();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userId, null, Collections.emptyList()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void createTag_shouldReturnCreatedTag() throws Exception {
        mockMvc.perform(post("/api/v1/tags")
                        .header("Authorization", authHeader)
                        .param("name", "important")
                        .param("color", "#ff0000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.name", is("important")));
    }

    @Test
    void listTags_shouldReturnEmpty_whenNoneExist() throws Exception {
        mockMvc.perform(get("/api/v1/tags")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data", hasSize(0)));
    }

    @Test
    void listTags_shouldReturnUserTagsOnly() throws Exception {
        TagEntity tag = new TagEntity();
        tag.setUserId(userId);
        tag.setName("my-tag");
        tagRepository.save(tag);

        TagEntity other = new TagEntity();
        other.setUserId("other-user");
        other.setName("other-tag");
        tagRepository.save(other);

        mockMvc.perform(get("/api/v1/tags")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].name", is("my-tag")));
    }

    @Test
    void deleteTag_shouldRemoveTag() throws Exception {
        TagEntity tag = new TagEntity();
        tag.setUserId(userId);
        tag.setName("delete-me");
        tagRepository.save(tag);

        mockMvc.perform(delete("/api/v1/tags/{id}", tag.getId())
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)));

        mockMvc.perform(get("/api/v1/tags")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(0)));
    }
}
