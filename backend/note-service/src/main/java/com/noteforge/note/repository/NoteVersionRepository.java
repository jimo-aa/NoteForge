package com.noteforge.note.repository;

import com.noteforge.note.entity.NoteVersionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface NoteVersionRepository extends JpaRepository<NoteVersionEntity, String> {
    List<NoteVersionEntity> findByNoteIdAndUserIdOrderByVersionNumberDesc(String noteId, String userId);
    List<NoteVersionEntity> findByNoteIdAndUserIdAndVersionNumberBetweenOrderByVersionNumberDesc(
        String noteId, String userId, int from, int to);
}
