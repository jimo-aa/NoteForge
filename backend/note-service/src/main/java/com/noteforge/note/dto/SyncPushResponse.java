package com.noteforge.note.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class SyncPushResponse {
    private int accepted;
    private long serverVersion;
    private List<ConflictItem> conflicts;

    @Data
    @AllArgsConstructor
    public static class ConflictItem {
        private String noteId;
        private long serverVersion;
        private int localVersion;
    }
}
