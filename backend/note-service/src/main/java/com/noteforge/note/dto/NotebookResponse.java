package com.noteforge.note.dto;

import com.noteforge.note.entity.NotebookEntity;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.ZoneOffset;

@Data
@AllArgsConstructor
public class NotebookResponse {
    private String id;
    private String userId;
    private String name;
    private String icon;
    private String color;
    private String parentId;
    private int sortOrder;
    private long createdAt;
    private long updatedAt;

    public static NotebookResponse fromEntity(NotebookEntity entity) {
        return new NotebookResponse(
            entity.getId(),
            entity.getUserId(),
            entity.getName(),
            entity.getIcon(),
            entity.getColor(),
            entity.getParentId(),
            entity.getSortOrder(),
            entity.getCreatedAt().toEpochSecond(ZoneOffset.UTC) * 1000,
            entity.getUpdatedAt().toEpochSecond(ZoneOffset.UTC) * 1000
        );
    }
}
