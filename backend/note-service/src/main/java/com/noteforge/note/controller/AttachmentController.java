package com.noteforge.note.controller;

import com.noteforge.common.response.ApiResponse;
import com.noteforge.note.dto.AttachmentResponse;
import com.noteforge.note.service.AttachmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
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
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String noteId) {
        AttachmentResponse response = attachmentService.uploadAttachment(file, auth.getName(), noteId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<AttachmentResponse>>> listAttachments(
            Authentication auth,
            @RequestParam(required = false) String noteId) {
        List<AttachmentResponse> attachments;
        if (noteId != null && !noteId.isEmpty()) {
            attachments = attachmentService.listAttachmentsByNoteId(noteId, auth.getName());
        } else {
            attachments = attachmentService.listAttachments(auth.getName());
        }
        return ResponseEntity.ok(ApiResponse.success(attachments));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AttachmentResponse>> getAttachment(
            Authentication auth,
            @PathVariable String id) {
        AttachmentResponse response = attachmentService.getAttachment(id, auth.getName());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<Resource> downloadAttachment(
            Authentication auth,
            @PathVariable String id) {
        Resource resource = attachmentService.downloadAttachment(id, auth.getName());
        MediaType mediaType = attachmentService.getAttachmentMediaType(id, auth.getName());
        String filename = attachmentService.getAttachment(id, auth.getName()).getFilename();
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(resource);
    }

    @GetMapping("/{id}/preview")
    public ResponseEntity<ApiResponse<AttachmentResponse>> previewAttachment(
            Authentication auth,
            @PathVariable String id) {
        AttachmentResponse response = attachmentService.getAttachment(id, auth.getName());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteAttachment(
            Authentication auth,
            @PathVariable String id) {
        attachmentService.deleteAttachment(id, auth.getName());
        return ResponseEntity.ok(ApiResponse.success());
    }
}
