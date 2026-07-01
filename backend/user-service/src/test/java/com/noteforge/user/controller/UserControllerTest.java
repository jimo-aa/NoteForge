package com.noteforge.user.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.noteforge.user.entity.UserEntity;
import com.noteforge.user.repository.UserRepository;
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
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    private String userId;
    private final String authHeader = "Bearer test-token";

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        UserEntity entity = new UserEntity();
        entity.setEmail("profile@example.com");
        entity.setPasswordHash("encoded-password");
        entity.setName("Profile User");
        userRepository.save(entity);
        userId = entity.getId();

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userId, null, Collections.emptyList()));
    }

    @Test
    void getMe_shouldReturnCurrentUser() throws Exception {
        mockMvc.perform(get("/api/v1/users/me")
                        .header("Authorization", authHeader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.email", is("profile@example.com")))
                .andExpect(jsonPath("$.data.name", is("Profile User")));
    }

    @Test
    void updateMe_shouldUpdateName() throws Exception {
        mockMvc.perform(put("/api/v1/users/me")
                        .header("Authorization", authHeader)
                        .param("name", "Updated Name"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.name", is("Updated Name")));
    }
}
