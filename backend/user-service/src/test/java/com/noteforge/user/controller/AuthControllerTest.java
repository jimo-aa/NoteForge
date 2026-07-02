package com.noteforge.user.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.noteforge.user.dto.LoginRequest;
import com.noteforge.user.dto.LogoutRequest;
import com.noteforge.user.dto.RefreshTokenRequest;
import com.noteforge.user.dto.RegisterRequest;
import com.noteforge.user.entity.UserEntity;
import com.noteforge.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;

import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.springframework.data.redis.core.ValueOperations;

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

    @MockBean
    private StringRedisTemplate stringRedisTemplate;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        when(stringRedisTemplate.opsForValue()).thenReturn(mock(ValueOperations.class));
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

    @Test
    void refresh_shouldReturnNewTokens() throws Exception {
        // Register a user
        RegisterRequest reg = new RegisterRequest();
        reg.setEmail("refresh@example.com");
        reg.setPassword("password123");
        reg.setName("Refresh User");

        String regResp = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reg)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        String oldRefresh = objectMapper.readTree(regResp).get("data").get("refreshToken").asText();

        // Refresh using the token — should succeed
        RefreshTokenRequest refreshReq = new RefreshTokenRequest();
        refreshReq.setRefreshToken(oldRefresh);

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(refreshReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken", notNullValue()))
                .andExpect(jsonPath("$.data.refreshToken", notNullValue()));
    }

    @Test
    void logout_shouldBlacklistAccessToken() throws Exception {
        // Register to get tokens
        RegisterRequest reg = new RegisterRequest();
        reg.setEmail("logout@example.com");
        reg.setPassword("password123");
        reg.setName("Logout User");

        String regResp = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reg)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        String accessToken = objectMapper.readTree(regResp).get("data").get("accessToken").asText();
        String refreshToken = objectMapper.readTree(regResp).get("data").get("refreshToken").asText();

        // Logout
        LogoutRequest logoutReq = new LogoutRequest();
        logoutReq.setRefreshToken(refreshToken);

        mockMvc.perform(post("/api/v1/auth/logout")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(logoutReq)))
                .andExpect(status().isOk());

        // Old refresh token should not work after logout
        RefreshTokenRequest refreshReq = new RefreshTokenRequest();
        refreshReq.setRefreshToken(refreshToken);
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(refreshReq)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void me_shouldReturnCurrentUser() throws Exception {
        // Pre-save a user directly to have a known ID in the auth context
        UserEntity entity = new UserEntity();
        entity.setEmail("me-api@example.com");
        entity.setPasswordHash(passwordEncoder.encode("password123"));
        entity.setName("Me API User");
        userRepository.save(entity);

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(entity.getId(), null, Collections.emptyList()));
        try {
            mockMvc.perform(get("/api/v1/auth/me"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code", is(0)))
                    .andExpect(jsonPath("$.data.email", is("me-api@example.com")))
                    .andExpect(jsonPath("$.data.role", is("USER")));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
