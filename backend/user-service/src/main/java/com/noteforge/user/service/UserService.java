package com.noteforge.user.service;

import com.noteforge.user.dto.UserResponse;
import com.noteforge.user.entity.UserEntity;
import com.noteforge.user.exception.ResourceNotFoundException;
import com.noteforge.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public UserResponse getUser(String userId) {
        UserEntity entity = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return UserResponse.fromEntity(entity);
    }

    public List<UserResponse> listAllUsers() {
        return userRepository.findAll().stream()
                .map(UserResponse::fromEntity)
                .collect(Collectors.toList());
    }

    public void deleteUser(String userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("User not found");
        }
        userRepository.deleteById(userId);
    }

    public UserResponse updateProfile(String userId, String name, String avatarUrl) {
        UserEntity entity = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (name != null) entity.setName(name);
        if (avatarUrl != null) entity.setAvatarUrl(avatarUrl);
        userRepository.save(entity);
        return UserResponse.fromEntity(entity);
    }
}
