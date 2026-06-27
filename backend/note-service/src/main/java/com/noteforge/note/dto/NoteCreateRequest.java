package com.noteforge.note.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.util.List;

@Data
public class NoteCreateRequest {

    @NotBlank @Size(max = 1024)
    private String title;

    private String content;

    private String notebookId;

    private List<String> tags;
}
