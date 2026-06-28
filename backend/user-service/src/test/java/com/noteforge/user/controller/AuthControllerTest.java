package com.noteforge.user.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.noteforge.user.dto.LoginRequest;
import com.noteforge.user.dto.RegisterRequest;
import com.noteforge.user.entity.UserEntity;
import com.noteforge.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
    }

    @Test
    void register_shouldCreateUserAndReturnTokens() throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setEmail("test@example.com");
        request.setPassword("password123");
        request.setName("Test User");

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.accessToken", notNullValue()))
                .andExpect(jsonPath("$.data.refreshToken", notNullValue()))
                .andExpect(jsonPath("$.data.user.email", is("test@example.com")));
    }

    @Test
    void register_shouldRejectDuplicateEmail() throws Exception {
        UserEntity entity = new UserEntity();
        entity.setEmail("dup@example.com");
        entity.setPasswordHash(passwordEncoder.encode("password123"));
        entity.setName("Dup User");
        userRepository.save(entity);

        RegisterRequest request = new RegisterRequest();
        request.setEmail("dup@example.com");
        request.setPassword("password123");
        request.setName("Another User");

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void login_shouldReturnTokens() throws Exception {
        UserEntity entity = new UserEntity();
        entity.setEmail("login@example.com");
        entity.setPasswordHash(passwordEncoder.encode("correct-password"));
        entity.setName("Login User");
        userRepository.save(entity);

        LoginRequest request = new LoginRequest();
        request.setEmail("login@example.com");
        request.setPassword("correct-password");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.accessToken", notNullValue()));
    }

    @Test
    void login_shouldRejectWrongPassword() throws Exception {
        UserEntity entity = new UserEntity();
        entity.setEmail("secure@example.com");
        entity.setPasswordHash(passwordEncoder.encode("real-password"));
        entity.setName("Secure User");
        userRepository.save(entity);

        LoginRequest request = new LoginRequest();
        request.setEmail("secure@example.com");
        request.setPassword("wrong-password");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void login_shouldRejectNonExistentUser() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setEmail("nobody@example.com");
        request.setPassword("password123");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }
}
