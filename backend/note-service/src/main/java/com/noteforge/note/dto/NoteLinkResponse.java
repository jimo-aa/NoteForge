package com.noteforge.note.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class NoteLinkResponse {
    private String noteId;
    private String title;
    private long updatedAt;
}
