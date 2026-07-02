package com.noteforge.note.service;

import com.noteforge.common.response.PageResponse;
import com.noteforge.note.dto.AuditLogResponse;
import com.noteforge.note.entity.AuditLogEntity;
import com.noteforge.note.repository.AuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * Records and queries audit trail entries for key operations
 * (create/delete/export/permission changes).
 */
@Service
@RequiredArgsConstructor
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    private final AuditLogRepository auditLogRepository;

    /**
     * Record an auditable action.
     *
     * @param userId       the acting user
     * @param action       e.g. "CREATE", "DELETE", "EXPORT", "PERMISSION_CHANGE"
     * @param resourceType e.g. "NOTE", "NOTEBOOK", "TAG", "ENCRYPTION"
     * @param resourceId   the affected resource ID (nullable)
     * @param detail       human-readable detail (nullable)
     * @param request      the HTTP request (for IP extraction, nullable)
     */
    public void record(String userId, String action, String resourceType,
                       String resourceId, String detail, HttpServletRequest request) {
        AuditLogEntity entity = new AuditLogEntity();
        entity.setUserId(userId);
        entity.setAction(action);
        entity.setResourceType(resourceType);
        entity.setResourceId(resourceId);
        entity.setDetail(detail);
        entity.setIpAddress(extractIp(request));
        auditLogRepository.save(entity);
        log.info("Audit: user={} action={} resource={}/{} detail={}",
                userId, action, resourceType, resourceId, detail);
    }

    /** Convenience overload when no HTTP request is available. */
    public void record(String userId, String action, String resourceType,
                       String resourceId, String detail) {
        record(userId, action, resourceType, resourceId, detail, null);
    }

    /** Query audit logs for a user, with optional action/resource filters. */
    public PageResponse<AuditLogResponse> queryLogs(
            String userId, String action, String resourceType,
            Long from, Long to, int page, int size) {
        PageRequest pr = PageRequest.of(page, size);
        Page<AuditLogEntity> entities;

        if (action != null && !action.isEmpty()) {
            entities = auditLogRepository
                    .findByUserIdAndActionOrderByCreatedAtDesc(userId, action, pr);
        } else if (resourceType != null && !resourceType.isEmpty()) {
            entities = auditLogRepository
                    .findByUserIdAndResourceTypeOrderByCreatedAtDesc(userId, resourceType, pr);
        } else if (from != null && to != null) {
            entities = auditLogRepository
                    .findByUserIdAndCreatedAtBetweenOrderByCreatedAtDesc(
                            userId, toLocalDateTime(from), toLocalDateTime(to), pr);
        } else {
            entities = auditLogRepository
                    .findByUserIdOrderByCreatedAtDesc(userId, pr);
        }

        return new PageResponse<>(
                entities.map(AuditLogResponse::fromEntity).getContent(),
                page, size,
                entities.getTotalElements(),
                entities.getTotalPages()
        );
    }

    private static String extractIp(HttpServletRequest request) {
        if (request == null) return "unknown";
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isEmpty() && !"unknown".equalsIgnoreCase(xff)) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static LocalDateTime toLocalDateTime(long epochMillis) {
        return LocalDateTime.ofInstant(
                java.time.Instant.ofEpochMilli(epochMillis),
                java.time.ZoneOffset.UTC);
    }
}
