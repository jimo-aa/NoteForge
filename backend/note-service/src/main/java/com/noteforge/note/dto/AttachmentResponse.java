package com.noteforge.note.dto;

import com.noteforge.note.entity.AttachmentEntity;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.ZoneOffset;

@Data
@AllArgsConstructor
public class AttachmentResponse {
    private String id;
    private String filename;
    private String contentType;
    private long size;
    private String url;
    private String noteId;
    private String previewUrl;
    private long createdAt;

    public static AttachmentResponse fromEntity(AttachmentEntity entity) {
        String id = entity.getId();
        return new AttachmentResponse(
            id,
            entity.getFilename(),
            entity.getContentType(),
            entity.getSize(),
            entity.getUrl(),
            entity.getNoteId(),
            "/api/v1/attachments/" + id + "/preview",
            entity.getCreatedAt().toEpochSecond(ZoneOffset.UTC) * 1000
        );
    }
}
