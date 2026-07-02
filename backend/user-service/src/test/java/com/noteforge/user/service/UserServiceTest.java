package com.noteforge.user.service;

import com.noteforge.user.dto.UserResponse;
import com.noteforge.user.entity.UserEntity;
import com.noteforge.user.entity.UserRole;
import com.noteforge.user.exception.ResourceNotFoundException;
import com.noteforge.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    private UserService userService;

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository);
    }

    private UserEntity createTestEntity(String id, String email, String name, UserRole role) {
        UserEntity entity = new UserEntity();
        entity.setId(id);
        entity.setEmail(email);
        entity.setPasswordHash("hashed-password");
        entity.setName(name);
        entity.setRole(role);
        return entity;
    }

    @Test
    void getUser_shouldReturnUser_whenExists() {
        UserEntity entity = createTestEntity("user-1", "test@example.com", "Test User", UserRole.USER);
        when(userRepository.findById("user-1")).thenReturn(Optional.of(entity));

        UserResponse response = userService.getUser("user-1");

        assertThat(response).isNotNull();
        assertThat(response.getId()).isEqualTo("user-1");
        assertThat(response.getEmail()).isEqualTo("test@example.com");
        assertThat(response.getName()).isEqualTo("Test User");
        assertThat(response.getRole()).isEqualTo(UserRole.USER);
    }

    @Test
    void getUser_shouldThrow_whenNotFound() {
        when(userRepository.findById("nonexistent")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getUser("nonexistent"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("User not found");
    }

    @Test
    void updateProfile_shouldUpdateNameAndAvatarUrl() {
        UserEntity entity = createTestEntity("user-2", "update@example.com", "Old Name", UserRole.USER);
        entity.setAvatarUrl("old-avatar.jpg");

        when(userRepository.findById("user-2")).thenReturn(Optional.of(entity));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserResponse response = userService.updateProfile("user-2", "New Name", "new-avatar.jpg");

        assertThat(response.getName()).isEqualTo("New Name");
        assertThat(entity.getName()).isEqualTo("New Name");
        assertThat(entity.getAvatarUrl()).isEqualTo("new-avatar.jpg");
        verify(userRepository).save(entity);
    }

    @Test
    void updateProfile_shouldKeepExistingFields_whenNullProvided() {
        UserEntity entity = createTestEntity("user-3", "partial@example.com", "Original Name", UserRole.USER);
        entity.setAvatarUrl("original-avatar.jpg");

        when(userRepository.findById("user-3")).thenReturn(Optional.of(entity));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserResponse response = userService.updateProfile("user-3", null, null);

        assertThat(response.getName()).isEqualTo("Original Name");
        assertThat(response.getAvatarUrl()).isEqualTo("original-avatar.jpg");
    }

    @Test
    void updateProfile_shouldThrow_whenUserNotFound() {
        when(userRepository.findById("nonexistent")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.updateProfile("nonexistent", "Name", null))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("User not found");
    }

    @Test
    void listAllUsers_shouldReturnAllUsers() {
        UserEntity user1 = createTestEntity("u1", "user1@example.com", "User One", UserRole.USER);
        UserEntity user2 = createTestEntity("u2", "user2@example.com", "User Two", UserRole.ADMIN);

        when(userRepository.findAll()).thenReturn(List.of(user1, user2));

        List<UserResponse> users = userService.listAllUsers();

        assertThat(users).hasSize(2);
        assertThat(users).extracting(UserResponse::getEmail)
                .containsExactlyInAnyOrder("user1@example.com", "user2@example.com");
    }

    @Test
    void listAllUsers_shouldReturnEmptyList_whenNoUsers() {
        when(userRepository.findAll()).thenReturn(List.of());

        List<UserResponse> users = userService.listAllUsers();

        assertThat(users).isEmpty();
    }

    @Test
    void deleteUser_shouldDelete_whenExists() {
        when(userRepository.existsById("user-to-delete")).thenReturn(true);

        userService.deleteUser("user-to-delete");

        verify(userRepository).deleteById("user-to-delete");
    }

    @Test
    void deleteUser_shouldThrow_whenNotFound() {
        when(userRepository.existsById("nonexistent")).thenReturn(false);

        assertThatThrownBy(() -> userService.deleteUser("nonexistent"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("User not found");

        verify(userRepository, never()).deleteById(any());
    }
}
