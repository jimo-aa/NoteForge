package com.noteforge.note.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class SyncPullResponse {
    private List<NoteResponse> notes;
    private List<String> deletedNoteIds;
    private long serverVersion;
}
