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
    private long createdAt;

    public static AttachmentResponse fromEntity(AttachmentEntity entity) {
        return new AttachmentResponse(
            entity.getId(),
            entity.getFilename(),
            entity.getContentType(),
            entity.getSize(),
            entity.getUrl(),
            entity.getCreatedAt().toEpochSecond(ZoneOffset.UTC) * 1000
        );
    }
}
