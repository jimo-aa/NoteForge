package com.noteforge.note.dto;

import com.noteforge.note.entity.AuditLogEntity;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AuditLogResponse {
    private String id;
    private String userId;
    private String action;
    private String resourceType;
    private String resourceId;
    private String detail;
    private String ipAddress;
    private long createdAt;

    public static AuditLogResponse fromEntity(AuditLogEntity entity) {
        return new AuditLogResponse(
            entity.getId(),
            entity.getUserId(),
            entity.getAction(),
            entity.getResourceType(),
            entity.getResourceId(),
            entity.getDetail(),
            entity.getIpAddress(),
            entity.getCreatedAt().atZone(java.time.ZoneOffset.UTC).toInstant().toEpochMilli()
        );
    }
}
