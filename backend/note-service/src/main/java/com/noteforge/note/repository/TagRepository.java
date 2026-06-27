package com.noteforge.note.repository;

import com.noteforge.note.entity.TagEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TagRepository extends JpaRepository<TagEntity, String> {
    List<TagEntity> findByUserId(String userId);
}
