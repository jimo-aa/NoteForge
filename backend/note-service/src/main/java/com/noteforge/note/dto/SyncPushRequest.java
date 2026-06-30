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
        private long clientVersion;
        private String title;
        private String content;
        private String notebookId;
        private List<String> tags;
        private Boolean isPinned;
        private Boolean isFavorite;
        private Boolean isDeleted;
    }
}
