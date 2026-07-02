package com.noteforge.note.repository;

import com.noteforge.note.entity.AuditLogEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLogEntity, String> {
    Page<AuditLogEntity> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);
    Page<AuditLogEntity> findByUserIdAndActionOrderByCreatedAtDesc(String userId, String action, Pageable pageable);
    Page<AuditLogEntity> findByUserIdAndResourceTypeOrderByCreatedAtDesc(String userId, String resourceType, Pageable pageable);
    Page<AuditLogEntity> findByUserIdAndCreatedAtBetweenOrderByCreatedAtDesc(String userId, LocalDateTime from, LocalDateTime to, Pageable pageable);
}
