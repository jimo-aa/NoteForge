package com.noteforge.note.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "attachments")
public class AttachmentEntity {

    @Id
    private String id;

    @Column(nullable = false)
    private String userId;

    private String noteId;

    @Column(nullable = false)
    private String filename;

    private String contentType;

    private long size;

    @Column(nullable = false)
    private String url;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (id == null) id = UUID.randomUUID().toString();
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
