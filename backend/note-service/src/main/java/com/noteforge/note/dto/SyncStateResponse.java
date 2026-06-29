package com.noteforge.note.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class SyncStateResponse {
    private long lastSyncVersion;
    private int pendingChanges;
    private int conflicts;
}
