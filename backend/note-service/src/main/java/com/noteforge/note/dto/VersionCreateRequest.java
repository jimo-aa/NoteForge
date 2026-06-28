package com.noteforge.note.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class VersionCreateRequest {
    @NotBlank(message = "Title is required")
    private String title;

    private String content;

    private String contentPlain;
}
