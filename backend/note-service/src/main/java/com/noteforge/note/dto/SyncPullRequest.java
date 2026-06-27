package com.noteforge.note.dto;

import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class SyncPullRequest {

    @Min(0)
    private long lastVersion;
}
