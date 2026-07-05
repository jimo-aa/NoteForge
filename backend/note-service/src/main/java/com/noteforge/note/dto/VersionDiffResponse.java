package com.noteforge.note.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

/**
 * Response for version diff/comparison.
 * Mirrors the diff capability from the desktop Rust core (LCS-based).
 */
@Data
@AllArgsConstructor
public class VersionDiffResponse {
    private int fromVersion;
    private int toVersion;
    private List<DiffOperation> operations;
    private float similarity;
    private ChangeSummary changeSummary;

    @Data
    @AllArgsConstructor
    public static class DiffOperation {
        private String opType;   // "add", "remove", "equal"
        private int lineNum;
        private String oldText;
        private String newText;
    }

    @Data
    @AllArgsConstructor
    public static class ChangeSummary {
        private int linesAdded;
        private int linesRemoved;
        private int linesModified;
        private int wordCountDelta;
    }
}
