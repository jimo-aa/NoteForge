package com.noteforge.note.controller;

import com.noteforge.common.response.ApiResponse;
import com.noteforge.note.dto.NotebookResponse;
import com.noteforge.note.service.NotebookService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/notebooks")
@RequiredArgsConstructor
public class NotebookController {

    private final NotebookService notebookService;

    @PostMapping
    public ResponseEntity<ApiResponse<NotebookResponse>> createNotebook(
            Authentication auth,
            @RequestParam String name,
            @RequestParam(required = false) String icon,
            @RequestParam(required = false) String color) {
        NotebookResponse notebook = notebookService.createNotebook(auth.getName(), name, icon, color);
        return ResponseEntity.ok(ApiResponse.success(notebook));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<NotebookResponse>>> listNotebooks(Authentication auth) {
        List<NotebookResponse> notebooks = notebookService.listNotebooks(auth.getName());
        return ResponseEntity.ok(ApiResponse.success(notebooks));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<NotebookResponse>> renameNotebook(
            Authentication auth,
            @PathVariable String id,
            @RequestParam String name) {
        NotebookResponse notebook = notebookService.renameNotebook(id, auth.getName(), name);
        return ResponseEntity.ok(ApiResponse.success(notebook));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteNotebook(
            Authentication auth,
            @PathVariable String id) {
        notebookService.deleteNotebook(id, auth.getName());
        return ResponseEntity.ok(ApiResponse.success());
    }
}
