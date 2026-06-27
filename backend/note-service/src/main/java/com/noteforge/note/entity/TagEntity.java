package com.noteforge.note.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "tags")
public class TagEntity {

    @Id
    private String id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false, unique = true)
    private String name;

    private String color;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (id == null) id = UUID.randomUUID().toString();
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
