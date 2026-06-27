package com.noteforge.note.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "sync_logs")
public class SyncLogEntity {

    @Id
    private String id;

    @Column(nullable = false)
    private String noteId;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String operation;

    @Column(columnDefinition = "TEXT")
    private String snapshot;

    private long version;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (id == null) id = UUID.randomUUID().toString();
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
