package com.noteforge.note.dto;

import com.noteforge.note.entity.TagEntity;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class TagResponse {
    private String id;
    private String userId;
    private String name;
    private String color;

    public static TagResponse fromEntity(TagEntity entity) {
        return new TagResponse(
            entity.getId(),
            entity.getUserId(),
            entity.getName(),
            entity.getColor()
        );
    }
}
