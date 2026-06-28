package com.noteforge.note.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "note_links")
public class NoteLinkEntity {

    @Id
    private String id;

    @Column(nullable = false)
    private String sourceNoteId;

    @Column(nullable = false)
    private String targetNoteId;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (id == null) id = UUID.randomUUID().toString();
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
