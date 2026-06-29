package com.noteforge.note.repository;

import com.noteforge.note.entity.AttachmentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AttachmentRepository extends JpaRepository<AttachmentEntity, String> {
    List<AttachmentEntity> findByUserIdOrderByCreatedAtDesc(String userId);
    List<AttachmentEntity> findByNoteIdAndUserId(String noteId, String userId);
}
