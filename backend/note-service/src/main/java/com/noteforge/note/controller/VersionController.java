package com.noteforge.note.controller;

import com.noteforge.common.response.ApiResponse;
import com.noteforge.note.dto.VersionCreateRequest;
import com.noteforge.note.dto.VersionResponse;
import com.noteforge.note.service.VersionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/notes/{noteId}/versions")
@RequiredArgsConstructor
public class VersionController {

    private final VersionService versionService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<VersionResponse>>> listVersions(
            Authentication auth,
            @PathVariable String noteId) {
        List<VersionResponse> versions = versionService.listVersions(noteId, auth.getName());
        return ResponseEntity.ok(ApiResponse.success(versions));
    }

    @GetMapping("/{versionNumber}")
    public ResponseEntity<ApiResponse<VersionResponse>> getVersion(
            Authentication auth,
            @PathVariable String noteId,
            @PathVariable int versionNumber) {
        VersionResponse version = versionService.getVersion(noteId, auth.getName(), versionNumber);
        return ResponseEntity.ok(ApiResponse.success(version));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<VersionResponse>> createVersion(
            Authentication auth,
            @PathVariable String noteId,
            @Valid @RequestBody VersionCreateRequest request) {
        VersionResponse version = versionService.createVersion(
                noteId, auth.getName(), request.getTitle(), request.getContent(), request.getContentPlain());
        return ResponseEntity.ok(ApiResponse.success(version));
    }
}
