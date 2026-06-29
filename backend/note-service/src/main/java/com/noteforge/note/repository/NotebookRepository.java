package com.noteforge.note.repository;

import com.noteforge.note.entity.NotebookEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotebookRepository extends JpaRepository<NotebookEntity, String> {
    List<NotebookEntity> findByUserIdAndIsDeletedFalseOrderBySortOrderAsc(String userId);
}
