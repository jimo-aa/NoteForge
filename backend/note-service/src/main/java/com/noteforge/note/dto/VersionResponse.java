package com.noteforge.note.dto;

import com.noteforge.note.entity.NoteVersionEntity;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.ZoneOffset;

@Data
@AllArgsConstructor
public class VersionResponse {
    private String noteId;
    private int versionNumber;
    private String title;
    private String content;
    private String contentPlain;
    private long createdAt;

    public static VersionResponse fromEntity(NoteVersionEntity entity) {
        return new VersionResponse(
            entity.getNoteId(),
            entity.getVersionNumber(),
            entity.getTitle(),
            entity.getContent(),
            entity.getContentPlain(),
            entity.getCreatedAt().toEpochSecond(ZoneOffset.UTC) * 1000
        );
    }
}
