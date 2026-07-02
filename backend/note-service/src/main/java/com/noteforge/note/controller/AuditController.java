package com.noteforge.note.controller;

import com.noteforge.common.response.ApiResponse;
import com.noteforge.common.response.PageResponse;
import com.noteforge.note.dto.AuditLogResponse;
import com.noteforge.note.service.AuditService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditService auditService;

    @GetMapping("/logs")
    public ResponseEntity<ApiResponse<PageResponse<AuditLogResponse>>> getAuditLogs(
            Authentication auth,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) Long from,
            @RequestParam(required = false) Long to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request) {
        PageResponse<AuditLogResponse> logs = auditService.queryLogs(
                auth.getName(), action, resourceType, from, to, page, size);
        return ResponseEntity.ok(ApiResponse.success(logs));
    }
}
