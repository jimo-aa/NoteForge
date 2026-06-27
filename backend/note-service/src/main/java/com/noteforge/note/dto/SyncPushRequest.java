package com.noteforge.note.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;
import java.util.List;

@Data
public class SyncPushRequest {

    @NotEmpty
    private List<SyncChangeItem> changes;

    @Data
    public static class SyncChangeItem {
        private String noteId;
        private String operation;
        private String snapshot;
        private long clientVersion;
    }
}
