package com.noteforge.note.controller;

import com.noteforge.common.response.ApiResponse;
import com.noteforge.note.dto.AttachmentResponse;
import com.noteforge.note.service.AttachmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/attachments")
@RequiredArgsConstructor
public class AttachmentController {

    private final AttachmentService attachmentService;

    @PostMapping("/upload")
    public ResponseEntity<ApiResponse<AttachmentResponse>> upload(
            Authentication auth,
            @RequestParam("file") MultipartFile file) {
        AttachmentResponse response = attachmentService.uploadAttachment(file, auth.getName());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<AttachmentResponse>>> listAttachments(
            Authentication auth) {
        List<AttachmentResponse> attachments = attachmentService.listAttachments(auth.getName());
        return ResponseEntity.ok(ApiResponse.success(attachments));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteAttachment(
            Authentication auth,
            @PathVariable String id) {
        attachmentService.deleteAttachment(id, auth.getName());
        return ResponseEntity.ok(ApiResponse.success());
    }
}
