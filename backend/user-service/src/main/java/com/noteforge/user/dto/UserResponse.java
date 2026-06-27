package com.noteforge.user.dto;

import com.noteforge.user.entity.UserEntity;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.ZoneOffset;

@Data
@AllArgsConstructor
public class UserResponse {
    private String id;
    private String email;
    private String name;
    private String avatarUrl;
    private long createdAt;
    private long updatedAt;

    public static UserResponse fromEntity(UserEntity entity) {
        return new UserResponse(
            entity.getId(),
            entity.getEmail(),
            entity.getName(),
            entity.getAvatarUrl(),
            entity.getCreatedAt() != null ? entity.getCreatedAt().toEpochSecond(ZoneOffset.UTC) * 1000 : 0,
            entity.getUpdatedAt() != null ? entity.getUpdatedAt().toEpochSecond(ZoneOffset.UTC) * 1000 : 0
        );
    }
}
