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

    @Query(value = "SELECT * FROM notes n WHERE n.user_id = :userId AND n.is_deleted = false " +
           "AND to_tsvector('simple', COALESCE(n.title, '') || ' ' || COALESCE(n.content_plain, '')) " +
           "@@ plainto_tsquery('simple', :query)",
           countQuery = "SELECT count(*) FROM notes n WHERE n.user_id = :userId AND n.is_deleted = false " +
                        "AND to_tsvector('simple', COALESCE(n.title, '') || ' ' || COALESCE(n.content_plain, '')) " +
                        "@@ plainto_tsquery('simple', :query)",
           nativeQuery = true)
    Page<NoteEntity> searchByFullText(@Param("userId") String userId,
                                      @Param("query") String query,
                                      Pageable pageable);

    // LIKE fallback for H2 / non-PostgreSQL environments (e.g. tests)
    @Query("SELECT n FROM NoteEntity n WHERE n.userId = :userId AND n.isDeleted = false " +
           "AND (n.title LIKE %:query% OR n.contentPlain LIKE %:query%)")
    Page<NoteEntity> searchByLike(@Param("userId") String userId,
                                   @Param("query") String query,
                                   Pageable pageable);

    // Tag filtering
    @Query("SELECT n FROM NoteEntity n WHERE n.userId = :userId AND n.isDeleted = false " +
           "AND :tag MEMBER OF n.tags ORDER BY n.updatedAt DESC")
    Page<NoteEntity> findByUserIdAndTagAndIsDeletedFalse(
        @Param("userId") String userId, @Param("tag") String tag, Pageable pageable);
}
