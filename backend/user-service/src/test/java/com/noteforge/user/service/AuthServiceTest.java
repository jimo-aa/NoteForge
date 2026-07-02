package com.noteforge.user.service;

import com.noteforge.user.dto.*;
import com.noteforge.user.entity.UserEntity;
import com.noteforge.user.entity.UserRole;
import com.noteforge.user.exception.ResourceNotFoundException;
import com.noteforge.user.repository.UserRepository;
import com.noteforge.user.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOps;

    private PasswordEncoder passwordEncoder;
    private TokenBlacklistService tokenBlacklistService;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder();
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
        tokenBlacklistService = new TokenBlacklistService(redisTemplate);
        authService = new AuthService(userRepository, passwordEncoder, jwtTokenProvider, tokenBlacklistService);
    }

    @Test
    void register_shouldCreateUserAndReturnTokens() {
        RegisterRequest request = new RegisterRequest();
        request.setEmail("test@example.com");
        request.setPassword("password123");
        request.setName("Test User");

        when(userRepository.existsByEmail("test@example.com")).thenReturn(false);
        when(userRepository.save(any(UserEntity.class))).thenAnswer(invocation -> {
            UserEntity saved = invocation.getArgument(0);
            saved.setId("user-123");
            return saved;
        });
        when(jwtTokenProvider.generateAccessToken(anyString(), anyString(), any(UserRole.class)))
                .thenReturn("access-token");
        when(jwtTokenProvider.generateRefreshToken(anyString()))
                .thenReturn("refresh-token");

        AuthResponse response = authService.register(request);

        assertThat(response).isNotNull();
        assertThat(response.getAccessToken()).isEqualTo("access-token");
        assertThat(response.getRefreshToken()).isEqualTo("refresh-token");
        assertThat(response.getUser()).isNotNull();
        assertThat(response.getUser().getEmail()).isEqualTo("test@example.com");
        assertThat(response.getUser().getRole()).isEqualTo(UserRole.USER);

        verify(userRepository).save(any(UserEntity.class));
        verify(jwtTokenProvider).generateAccessToken(anyString(), anyString(), eq(UserRole.USER));
    }

    @Test
    void register_shouldThrow_whenEmailAlreadyExists() {
        RegisterRequest request = new RegisterRequest();
        request.setEmail("dup@example.com");
        request.setPassword("password123");
        request.setName("Dup User");

        when(userRepository.existsByEmail("dup@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Email already registered");

        verify(userRepository, never()).save(any());
    }

    @Test
    void login_shouldReturnTokens_forValidCredentials() {
        UserEntity entity = new UserEntity();
        entity.setId("user-456");
        entity.setEmail("login@example.com");
        entity.setPasswordHash(passwordEncoder.encode("correct-password"));
        entity.setName("Login User");
        entity.setRole(UserRole.USER);

        when(userRepository.findByEmail("login@example.com")).thenReturn(Optional.of(entity));
        when(jwtTokenProvider.generateAccessToken("user-456", "login@example.com", UserRole.USER))
                .thenReturn("access-token");
        when(jwtTokenProvider.generateRefreshToken("user-456"))
                .thenReturn("refresh-token");

        LoginRequest request = new LoginRequest();
        request.setEmail("login@example.com");
        request.setPassword("correct-password");

        AuthResponse response = authService.login(request);

        assertThat(response.getAccessToken()).isEqualTo("access-token");
        assertThat(response.getRefreshToken()).isEqualTo("refresh-token");
    }

    @Test
    void login_shouldThrow_forWrongPassword() {
        UserEntity entity = new UserEntity();
        entity.setEmail("secure@example.com");
        entity.setPasswordHash(passwordEncoder.encode("real-password"));
        entity.setName("Secure User");

        when(userRepository.findByEmail("secure@example.com")).thenReturn(Optional.of(entity));

        LoginRequest request = new LoginRequest();
        request.setEmail("secure@example.com");
        request.setPassword("wrong-password");

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessageContaining("Invalid email or password");
    }

    @Test
    void login_shouldThrow_forNonExistentEmail() {
        when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());

        LoginRequest request = new LoginRequest();
        request.setEmail("nobody@example.com");
        request.setPassword("password123");

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessageContaining("Invalid email or password");
    }

    @Test
    void refreshToken_shouldReturnNewTokens_forValidRefreshToken() {
        // We need activeRefreshTokens populated. Use reflection to inject directly.
        // This avoids complex register mock setup.
        UserEntity entity = new UserEntity();
        entity.setId("user-789");
        entity.setEmail("refresh@example.com");
        entity.setName("Refresh User");
        entity.setRole(UserRole.USER);

        // Populate activeRefreshTokens via register first
        when(userRepository.existsByEmail("seed@example.com")).thenReturn(false);
        when(userRepository.save(any(UserEntity.class))).thenAnswer(invocation -> {
            UserEntity saved = invocation.getArgument(0);
            saved.setId("user-789");
            return saved;
        });
        when(jwtTokenProvider.generateAccessToken(anyString(), anyString(), any(UserRole.class)))
                .thenReturn("dummy-access");
        when(jwtTokenProvider.generateRefreshToken(anyString()))
                .thenReturn("valid-refresh-token");

        RegisterRequest regReq = new RegisterRequest();
        regReq.setEmail("seed@example.com");
        regReq.setPassword("password123");
        regReq.setName("Seed User");
        authService.register(regReq);

        // Now refresh: set up mocks for refresh call
        when(jwtTokenProvider.validateToken("valid-refresh-token")).thenReturn(true);
        when(userRepository.findById("user-789")).thenReturn(Optional.of(entity));
        when(jwtTokenProvider.generateAccessToken("user-789", "refresh@example.com", UserRole.USER))
                .thenReturn("new-access-token");
        when(jwtTokenProvider.generateRefreshToken("user-789"))
                .thenReturn("new-refresh-token");

        RefreshTokenRequest refreshReq = new RefreshTokenRequest();
        refreshReq.setRefreshToken("valid-refresh-token");

        AuthResponse response = authService.refreshToken(refreshReq);

        assertThat(response.getAccessToken()).isEqualTo("new-access-token");
        assertThat(response.getRefreshToken()).isEqualTo("new-refresh-token");
        assertThat(response.getUser()).isNotNull();

        // Old refresh token should no longer work (rotation)
        when(jwtTokenProvider.validateToken("valid-refresh-token")).thenReturn(true);
        assertThatThrownBy(() -> authService.refreshToken(refreshReq))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already been used");
    }

    @Test
    void refreshToken_shouldThrow_forInvalidRefreshToken() {
        when(jwtTokenProvider.validateToken("invalid-token")).thenReturn(false);

        RefreshTokenRequest request = new RefreshTokenRequest();
        request.setRefreshToken("invalid-token");

        assertThatThrownBy(() -> authService.refreshToken(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid or expired refresh token");
    }

    @Test
    void refreshToken_shouldThrow_forAlreadyUsedRefreshToken() {
        when(jwtTokenProvider.validateToken("already-used")).thenReturn(true);

        RefreshTokenRequest request = new RefreshTokenRequest();
        request.setRefreshToken("already-used");

        assertThatThrownBy(() -> authService.refreshToken(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already been used");
    }

    @Test
    void logout_shouldBlacklistAccessTokenAndRemoveRefreshToken() {
        // Setup: register a user to get active refresh token
        RegisterRequest regReq = new RegisterRequest();
        regReq.setEmail("logout@example.com");
        regReq.setPassword("password123");
        regReq.setName("Logout User");

        when(userRepository.existsByEmail("logout@example.com")).thenReturn(false);
        when(userRepository.save(any(UserEntity.class))).thenAnswer(invocation -> {
            UserEntity saved = invocation.getArgument(0);
            saved.setId("logout-user-id");
            return saved;
        });
        when(jwtTokenProvider.generateAccessToken(anyString(), anyString(), any(UserRole.class)))
                .thenReturn("access-token");
        when(jwtTokenProvider.generateRefreshToken(anyString()))
                .thenReturn("refresh-token");

        authService.register(regReq);

        // Now logout
        when(jwtTokenProvider.getExpiryFromToken("access-token")).thenReturn(System.currentTimeMillis() + 60000L);

        LogoutRequest logoutReq = new LogoutRequest();
        logoutReq.setRefreshToken("refresh-token");
        authService.logout(logoutReq, "access-token");

        // Old refresh token should not work
        when(jwtTokenProvider.validateToken("refresh-token")).thenReturn(true);
        RefreshTokenRequest refreshReq = new RefreshTokenRequest();
        refreshReq.setRefreshToken("refresh-token");
        assertThatThrownBy(() -> authService.refreshToken(refreshReq))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already been used");
    }

    @Test
    void getCurrentUser_shouldReturnUser_fromSecurityContext() {
        UserEntity entity = new UserEntity();
        entity.setId("current-user");
        entity.setEmail("current@example.com");
        entity.setName("Current User");
        entity.setRole(UserRole.USER);

        when(userRepository.findById("current-user")).thenReturn(Optional.of(entity));

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("current-user", null));
        try {
            UserResponse response = authService.getCurrentUser();
            assertThat(response).isNotNull();
            assertThat(response.getId()).isEqualTo("current-user");
            assertThat(response.getEmail()).isEqualTo("current@example.com");
            assertThat(response.getRole()).isEqualTo(UserRole.USER);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void getCurrentUser_shouldThrow_whenUserNotFound() {
        when(userRepository.findById("nonexistent")).thenReturn(Optional.empty());

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("nonexistent", null));
        try {
            assertThatThrownBy(() -> authService.getCurrentUser())
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("User not found");
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
