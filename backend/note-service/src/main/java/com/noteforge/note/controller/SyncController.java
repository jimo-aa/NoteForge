package com.noteforge.note.controller;

import com.noteforge.common.response.ApiResponse;
import com.noteforge.note.dto.*;
import com.noteforge.note.service.SyncService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/sync")
@RequiredArgsConstructor
public class SyncController {

    private final SyncService syncService;

    @GetMapping("/state")
    public ResponseEntity<ApiResponse<SyncStateResponse>> getSyncState(Authentication auth) {
        SyncStateResponse state = syncService.getSyncState(auth.getName());
        return ResponseEntity.ok(ApiResponse.success(state));
    }

    @PostMapping("/pull")
    public ResponseEntity<ApiResponse<SyncPullResponse>> pull(
            Authentication auth,
            @Valid @RequestBody SyncPullRequest request) {
        SyncPullResponse response = syncService.pullChanges(auth.getName(), request.getLastVersion());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/push")
    public ResponseEntity<ApiResponse<SyncPushResponse>> push(
            Authentication auth,
            @Valid @RequestBody SyncPushRequest request) {
        SyncPushResponse response = syncService.pushChanges(auth.getName(), request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/conflicts")
    public ResponseEntity<ApiResponse<List<String>>> getConflicts(
            Authentication auth,
            @RequestParam(defaultValue = "0") long clientVersion) {
        List<String> conflictedNotes = syncService.resolveConflicts(auth.getName(), clientVersion);
        return ResponseEntity.ok(ApiResponse.success(conflictedNotes));
    }
}
