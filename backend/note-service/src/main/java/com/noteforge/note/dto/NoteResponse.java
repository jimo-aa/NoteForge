package com.noteforge.note.dto;

import com.noteforge.note.entity.NoteEntity;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.ZoneOffset;
import java.util.List;

@Data
@AllArgsConstructor
public class NoteResponse {
    private String id;
    private String userId;
    private String notebookId;
    private String title;
    private String content;
    private String contentPlain;
    private List<String> tags;
    private boolean isPinned;
    private boolean isFavorite;
    private int wordCount;
    private int version;
    private long createdAt;
    private long updatedAt;

    public static NoteResponse fromEntity(NoteEntity entity) {
        return new NoteResponse(
            entity.getId(),
            entity.getUserId(),
            entity.getNotebookId(),
            entity.getTitle(),
            entity.getContent(),
            entity.getContentPlain(),
            entity.getTags(),
            entity.isPinned(),
            entity.isFavorite(),
            entity.getWordCount(),
            entity.getVersion(),
            entity.getCreatedAt().toEpochSecond(ZoneOffset.UTC) * 1000,
            entity.getUpdatedAt().toEpochSecond(ZoneOffset.UTC) * 1000
        );
    }
}
