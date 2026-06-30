package com.noteforge.note.repository;

import com.noteforge.note.entity.SyncLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SyncLogRepository extends JpaRepository<SyncLogEntity, String> {
    List<SyncLogEntity> findByUserIdAndVersionGreaterThanOrderByVersionAsc(String userId, long version);
    List<SyncLogEntity> findByNoteIdAndUserIdOrderByVersionAsc(String noteId, String userId);
    List<SyncLogEntity> findByNoteIdAndUserIdOrderByVersionDesc(String noteId, String userId);
}
