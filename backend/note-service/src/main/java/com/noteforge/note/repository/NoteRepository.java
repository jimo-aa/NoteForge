package com.noteforge.note.repository;

import com.noteforge.note.entity.NoteEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NoteRepository extends JpaRepository<NoteEntity, String> {

    List<NoteEntity> findByUserIdAndIsDeletedFalseOrderByUpdatedAtDesc(String userId);

    Page<NoteEntity> findByUserIdAndIsDeletedFalse(String userId, Pageable pageable);

    List<NoteEntity> findByUserIdAndNotebookIdAndIsDeletedFalseOrderByUpdatedAtDesc(
            String userId, String notebookId);

    Page<NoteEntity> findByUserIdAndNotebookIdAndIsDeletedFalse(
            String userId, String notebookId, Pageable pageable);

    List<NoteEntity> findByUserIdAndIsFavoriteTrueAndIsDeletedFalse(String userId);

    @Query(value = "SELECT n FROM NoteEntity n WHERE n.userId = :userId AND n.isDeleted = false " +
           "AND to_tsvector('simple', n.title || ' ' || n.contentPlain) @@ plainto_tsquery('simple', :query)")
    Page<NoteEntity> searchByFullText(@Param("userId") String userId,
                                      @Param("query") String query,
                                      Pageable pageable);
}
