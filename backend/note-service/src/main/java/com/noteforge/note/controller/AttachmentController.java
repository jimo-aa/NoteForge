package com.noteforge.note.controller;

import com.noteforge.common.response.ApiResponse;
import com.noteforge.note.service.AttachmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/attachments")
@RequiredArgsConstructor
public class AttachmentController {

    private final AttachmentService attachmentService;

    @PostMapping("/upload")
    public ResponseEntity<ApiResponse<String>> upload(
            Authentication auth,
            @RequestParam("file") MultipartFile file) {
        String url = attachmentService.uploadAttachment(file, auth.getName());
        return ResponseEntity.ok(ApiResponse.success(url));
    }
}
