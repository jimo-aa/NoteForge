package com.noteforge.note.repository;

import com.noteforge.note.entity.NoteLinkEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface NoteLinkRepository extends JpaRepository<NoteLinkEntity, String> {
    List<NoteLinkEntity> findByTargetNoteIdAndUserId(String targetNoteId, String userId);
    List<NoteLinkEntity> findBySourceNoteIdAndUserId(String sourceNoteId, String userId);
    void deleteBySourceNoteIdAndUserId(String sourceNoteId, String userId);
}
