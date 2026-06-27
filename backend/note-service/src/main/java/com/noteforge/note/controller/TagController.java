package com.noteforge.note.controller;

import com.noteforge.common.response.ApiResponse;
import com.noteforge.note.dto.TagResponse;
import com.noteforge.note.service.TagService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/tags")
@RequiredArgsConstructor
public class TagController {

    private final TagService tagService;

    @PostMapping
    public ResponseEntity<ApiResponse<TagResponse>> createTag(
            Authentication auth,
            @RequestParam String name,
            @RequestParam(required = false) String color) {
        TagResponse tag = tagService.createTag(auth.getName(), name, color);
        return ResponseEntity.ok(ApiResponse.success(tag));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<TagResponse>>> listTags(Authentication auth) {
        List<TagResponse> tags = tagService.listTags(auth.getName());
        return ResponseEntity.ok(ApiResponse.success(tags));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteTag(
            Authentication auth,
            @PathVariable String id) {
        tagService.deleteTag(id, auth.getName());
        return ResponseEntity.ok(ApiResponse.success());
    }
}
