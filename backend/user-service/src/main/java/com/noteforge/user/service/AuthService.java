package com.noteforge.user.service;

import com.noteforge.user.dto.*;
import com.noteforge.user.entity.UserEntity;
import com.noteforge.user.repository.UserRepository;
import com.noteforge.user.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already registered");
        }

        UserEntity entity = new UserEntity();
        entity.setEmail(request.getEmail());
        entity.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        entity.setName(request.getName());
        userRepository.save(entity);

        UserResponse userResp = UserResponse.fromEntity(entity);
        String accessToken = jwtTokenProvider.generateAccessToken(entity.getId(), entity.getEmail());
        String refreshToken = jwtTokenProvider.generateRefreshToken(entity.getId());

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

        return new AuthResponse(accessToken, refreshToken, userResp);
    }

    public AuthResponse refreshToken(RefreshTokenRequest request) {
        String token = request.getRefreshToken();
        if (!jwtTokenProvider.validateToken(token)) {
            throw new IllegalArgumentException("Invalid or expired refresh token");
        }
        String userId = jwtTokenProvider.getUserIdFromToken(token);
        UserEntity entity = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        UserResponse userResp = UserResponse.fromEntity(entity);
        String newAccessToken = jwtTokenProvider.generateAccessToken(entity.getId(), entity.getEmail());
        String newRefreshToken = jwtTokenProvider.generateRefreshToken(entity.getId());

        return new AuthResponse(newAccessToken, newRefreshToken, userResp);
    }
}
