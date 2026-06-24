package com.noteforge.note.repository;

import com.noteforge.note.entity.NoteEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NoteRepository extends JpaRepository<NoteEntity, String> {

    List<NoteEntity> findByUserIdAndIsDeletedFalseOrderByUpdatedAtDesc(String userId);

    List<NoteEntity> findByUserIdAndNotebookIdAndIsDeletedFalseOrderByUpdatedAtDesc(
            String userId, String notebookId);

    List<NoteEntity> findByUserIdAndIsFavoriteTrueAndIsDeletedFalse(String userId);
}
