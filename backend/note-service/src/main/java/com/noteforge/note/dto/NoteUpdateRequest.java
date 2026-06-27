package com.noteforge.note.dto;

import lombok.Data;
import java.util.List;

@Data
public class NoteUpdateRequest {

    private String title;

    private String content;

    private String notebookId;

    private List<String> tags;

    private Boolean isPinned;

    private Boolean isFavorite;
}
