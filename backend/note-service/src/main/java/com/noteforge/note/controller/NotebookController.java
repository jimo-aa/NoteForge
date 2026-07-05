package com.noteforge.note.controller;

import com.noteforge.common.response.ApiResponse;
import com.noteforge.note.dto.NotebookResponse;
import com.noteforge.note.service.ExportService;
import com.noteforge.note.service.NotebookService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/v1/notebooks")
@RequiredArgsConstructor
public class NotebookController {

    private final NotebookService notebookService;
    private final ExportService exportService;

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

    @PutMapping("/reorder")
    public ResponseEntity<ApiResponse<Void>> reorderNotebooks(
            Authentication auth,
            @RequestBody List<String> orderedIds) {
        notebookService.reorderNotebooks(auth.getName(), orderedIds);
        return ResponseEntity.ok(ApiResponse.success());
    }

    /**
     * Export all notes in a notebook.
     * GET /api/v1/notebooks/{id}/export?format=markdown|json
     */
    @GetMapping("/{id}/export")
    public ResponseEntity<Resource> exportNotebook(
            Authentication auth,
            @PathVariable String id,
            @RequestParam(defaultValue = "markdown") String format) {
        NotebookResponse notebook = notebookService.getNotebook(id, auth.getName());
        byte[] content;
        String extension;
        MediaType mediaType;

        switch (format) {
            case "json" -> {
                content = exportService.exportNotebookAsJson(id, auth.getName());
                extension = ".json";
                mediaType = MediaType.APPLICATION_JSON;
            }
            default -> {
                content = exportService.exportNotebookAsMarkdown(id, auth.getName());
                extension = ".md";
                mediaType = MediaType.parseMediaType("text/markdown");
            }
        }

        String filename = sanitizeFilename(notebook.getName()) + extension;
        ByteArrayResource resource = new ByteArrayResource(content);

        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(filename, StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .contentType(mediaType)
                .contentLength(content.length)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(resource);
    }

    private String sanitizeFilename(String name) {
        return name.replaceAll("[\\\\/:*?\"<>|]", "_").replaceAll("\\s+", "_");
    }
}
