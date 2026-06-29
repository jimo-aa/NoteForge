package com.noteforge.note.controller;

import com.noteforge.common.response.ApiResponse;
import com.noteforge.common.response.PageResponse;
import com.noteforge.note.dto.*;
import com.noteforge.note.service.NoteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/notes")
@RequiredArgsConstructor
public class NoteController {

    private final NoteService noteService;

    @PostMapping
    public ResponseEntity<ApiResponse<NoteResponse>> createNote(
            Authentication auth,
            @Valid @RequestBody NoteCreateRequest request) {
        NoteResponse note = noteService.createNote(auth.getName(), request);
        return ResponseEntity.ok(ApiResponse.success(note));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<NoteResponse>> getNote(
            Authentication auth,
            @PathVariable String id) {
        NoteResponse note = noteService.getNote(id, auth.getName());
        return ResponseEntity.ok(ApiResponse.success(note));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<NoteResponse>> updateNote(
            Authentication auth,
            @PathVariable String id,
            @Valid @RequestBody NoteUpdateRequest request) {
        NoteResponse note = noteService.updateNote(id, auth.getName(), request);
        return ResponseEntity.ok(ApiResponse.success(note));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteNote(
            Authentication auth,
            @PathVariable String id) {
        noteService.deleteNote(id, auth.getName());
        return ResponseEntity.ok(ApiResponse.success());
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<NoteResponse>>> listNotes(
            Authentication auth,
            @RequestParam(required = false) String notebookId,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) Boolean isFavorite,
            @RequestParam(required = false) Boolean isPinned,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<NoteResponse> result = noteService.listNotesWithFilter(
                auth.getName(), notebookId, tag, isFavorite, isPinned, page, size);
        PageResponse<NoteResponse> pageResp = new PageResponse<>(
                result.getContent(), page, size, result.getTotalElements(), result.getTotalPages());
        return ResponseEntity.ok(ApiResponse.success(pageResp));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<PageResponse<NoteResponse>>> searchNotes(
            Authentication auth,
            @RequestParam String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<NoteResponse> result = noteService.searchNotes(auth.getName(), q, page, size);
        PageResponse<NoteResponse> pageResp = new PageResponse<>(
                result.getContent(), page, size, result.getTotalElements(), result.getTotalPages());
        return ResponseEntity.ok(ApiResponse.success(pageResp));
    }

    @GetMapping("/{id}/backlinks")
    public ResponseEntity<ApiResponse<List<NoteLinkResponse>>> getBacklinks(
            Authentication auth,
            @PathVariable String id) {
        List<NoteLinkResponse> backlinks = noteService.getBacklinks(id, auth.getName());
        return ResponseEntity.ok(ApiResponse.success(backlinks));
    }
}
