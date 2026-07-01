package com.noteforge.user.service;

import com.noteforge.user.dto.*;
import com.noteforge.user.entity.UserEntity;
import com.noteforge.user.entity.UserRole;
import com.noteforge.user.exception.ResourceNotFoundException;
import com.noteforge.user.repository.UserRepository;
import com.noteforge.user.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final TokenBlacklistService tokenBlacklistService;

    /** Active refresh tokens per user (rotation). tokenHash -> userId */
    private final ConcurrentHashMap<String, String> activeRefreshTokens = new ConcurrentHashMap<>();

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already registered");
        }

        UserEntity entity = new UserEntity();
        entity.setEmail(request.getEmail());
        entity.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        entity.setName(request.getName());
        if (request.getRole() != null) {
            entity.setRole(request.getRole());
        }
        userRepository.save(entity);

        UserResponse userResp = UserResponse.fromEntity(entity);
        String accessToken = jwtTokenProvider.generateAccessToken(entity.getId(), entity.getEmail());
        String refreshToken = jwtTokenProvider.generateRefreshToken(entity.getId());

        activeRefreshTokens.put(refreshToken, entity.getId());

        return new AuthResponse(accessToken, refreshToken, userResp);
    }

    public AuthResponse login(LoginRequest request) {
        UserEntity entity = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), entity.getPasswordHash())) {
            throw new BadCredentialsException("Invalid email or password");
        }

        UserResponse userResp = UserResponse.fromEntity(entity);
        String accessToken = jwtTokenProvider.generateAccessToken(entity.getId(), entity.getEmail());
        String refreshToken = jwtTokenProvider.generateRefreshToken(entity.getId());

        activeRefreshTokens.put(refreshToken, entity.getId());

        return new AuthResponse(accessToken, refreshToken, userResp);
    }

    public AuthResponse refreshToken(RefreshTokenRequest request) {
        String token = request.getRefreshToken();
        if (!jwtTokenProvider.validateToken(token)) {
            throw new IllegalArgumentException("Invalid or expired refresh token");
        }

        // Rotation: revoke old refresh token
        String userId = activeRefreshTokens.remove(token);
        if (userId == null) {
            throw new IllegalArgumentException("Refresh token has already been used or revoked");
        }

        UserEntity entity = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        UserResponse userResp = UserResponse.fromEntity(entity);
        String newAccessToken = jwtTokenProvider.generateAccessToken(entity.getId(), entity.getEmail());
        String newRefreshToken = jwtTokenProvider.generateRefreshToken(entity.getId());

        // Store new refresh token
        activeRefreshTokens.put(newRefreshToken, entity.getId());

        return new AuthResponse(newAccessToken, newRefreshToken, userResp);
    }

    public void logout(LogoutRequest request, String accessToken) {
        // Blacklist access token (use its remaining expiry)
        long expiry = jwtTokenProvider.getExpiryFromToken(accessToken);
        tokenBlacklistService.blacklist(accessToken, expiry);

        // Remove refresh token from active set
        activeRefreshTokens.remove(request.getRefreshToken());
    }

    public UserResponse getCurrentUser() {
        String userId = SecurityContextHolder.getContext().getAuthentication().getName();
        UserEntity entity = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return UserResponse.fromEntity(entity);
    }
}
