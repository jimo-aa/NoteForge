package com.noteforge.note.controller;

import com.noteforge.common.response.ApiResponse;
import com.noteforge.note.dto.SyncPullRequest;
import com.noteforge.note.dto.SyncPushRequest;
import com.noteforge.note.dto.SyncStateResponse;
import com.noteforge.note.entity.SyncLogEntity;
import com.noteforge.note.service.SyncService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
    public ResponseEntity<ApiResponse<List<SyncLogEntity>>> pull(
            Authentication auth,
            @Valid @RequestBody SyncPullRequest request) {
        List<SyncLogEntity> changes = syncService.pullChanges(auth.getName(), request.getLastVersion());
        return ResponseEntity.ok(ApiResponse.success(changes));
    }

    @PostMapping("/push")
    public ResponseEntity<ApiResponse<Void>> push(
            Authentication auth,
            @Valid @RequestBody SyncPushRequest request) {
        syncService.pushChanges(auth.getName(), request);
        return ResponseEntity.ok(ApiResponse.success());
    }
}
