package com.noteforge.note.controller;

import com.noteforge.common.response.ApiResponse;
import com.noteforge.common.response.PageResponse;
import com.noteforge.note.dto.NoteResponse;
import com.noteforge.note.service.NoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/search")
@RequiredArgsConstructor
public class SearchController {

    private final NoteService noteService;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<NoteResponse>>> globalSearch(
            Authentication auth,
            @RequestParam String q,
            @RequestParam(required = false, defaultValue = "fulltext") String mode,
            @RequestParam(required = false) String tag,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<NoteResponse> result = noteService.searchNotes(auth.getName(), q, page, size);
        PageResponse<NoteResponse> pageResp = new PageResponse<>(
                result.getContent(), page, size, result.getTotalElements(), result.getTotalPages());
        return ResponseEntity.ok(ApiResponse.success(pageResp));
    }

    /**
     * Fuzzy search — typo-tolerant matching using PostgreSQL ILIKE.
     * Splits query into words, matches word boundaries and partial strings.
     */
    @GetMapping("/fuzzy")
    public ResponseEntity<ApiResponse<PageResponse<NoteResponse>>> fuzzySearch(
            Authentication auth,
            @RequestParam String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<NoteResponse> result = noteService.searchNotesFuzzy(auth.getName(), q, page, size);
        PageResponse<NoteResponse> pageResp = new PageResponse<>(
                result.getContent(), page, size, result.getTotalElements(), result.getTotalPages());
        return ResponseEntity.ok(ApiResponse.success(pageResp));
    }
}
