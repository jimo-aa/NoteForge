package com.noteforge.note.service;

import com.noteforge.note.dto.VersionDiffResponse;
import com.noteforge.note.dto.VersionDiffResponse.ChangeSummary;
import com.noteforge.note.dto.VersionDiffResponse.DiffOperation;
import com.noteforge.note.dto.VersionResponse;
import com.noteforge.note.entity.NoteVersionEntity;
import com.noteforge.note.exception.ResourceNotFoundException;
import com.noteforge.note.repository.NoteVersionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class VersionService {

    private final NoteVersionRepository noteVersionRepository;

    /**
     * Create a manual version snapshot (named checkpoint).
     * Takes explicit content — the caller is responsible for providing the current note content.
     */
    public VersionResponse createSnapshot(String noteId, String userId, String title, String description,
                                           String content, String contentPlain) {
        List<NoteVersionEntity> existing = noteVersionRepository.findByNoteIdAndUserIdOrderByVersionNumberDesc(noteId, userId);
        int nextVersion = existing.isEmpty() ? 1 : existing.get(0).getVersionNumber() + 1;

        NoteVersionEntity entity = new NoteVersionEntity();
        entity.setNoteId(noteId);
        entity.setUserId(userId);
        entity.setVersionNumber(nextVersion);
        entity.setTitle(title);
        entity.setDescription(description);
        entity.setContent(content != null ? content : "");
        entity.setContentPlain(contentPlain);
        noteVersionRepository.save(entity);

        return VersionResponse.fromEntity(entity);
    }

    /**
     * Create an auto-saved version snapshot (triggered on note update).
     */
    public VersionResponse createAutoSnapshot(String noteId, String userId, String content, String contentPlain) {
        List<NoteVersionEntity> existing = noteVersionRepository.findByNoteIdAndUserIdOrderByVersionNumberDesc(noteId, userId);
        int nextVersion = existing.isEmpty() ? 1 : existing.get(0).getVersionNumber() + 1;

        NoteVersionEntity entity = new NoteVersionEntity();
        entity.setNoteId(noteId);
        entity.setUserId(userId);
        entity.setVersionNumber(nextVersion);
        entity.setTitle("Auto-save #" + nextVersion);
        entity.setContent(content != null ? content : "");
        entity.setContentPlain(contentPlain);
        noteVersionRepository.save(entity);

        return VersionResponse.fromEntity(entity);
    }

    public List<VersionResponse> listVersions(String noteId, String userId) {
        return noteVersionRepository.findByNoteIdAndUserIdOrderByVersionNumberDesc(noteId, userId)
                .stream()
                .map(VersionResponse::fromEntity)
                .toList();
    }

    public VersionResponse getVersion(String noteId, String userId, int versionNumber) {
        NoteVersionEntity entity = noteVersionRepository.findByNoteIdAndUserIdAndVersionNumberBetweenOrderByVersionNumberDesc(
                noteId, userId, versionNumber, versionNumber)
                .stream()
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Version not found"));
        return VersionResponse.fromEntity(entity);
    }

    /**
     * Compute LCS-based diff between two versions of a note.
     */
    public VersionDiffResponse compareVersionsDiff(String noteId, String userId, int fromVersion, int toVersion) {
        NoteVersionEntity from = noteVersionRepository
                .findByNoteIdAndUserIdAndVersionNumberBetweenOrderByVersionNumberDesc(noteId, userId, fromVersion, fromVersion)
                .stream()
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Source version not found: " + fromVersion));

        NoteVersionEntity to = noteVersionRepository
                .findByNoteIdAndUserIdAndVersionNumberBetweenOrderByVersionNumberDesc(noteId, userId, toVersion, toVersion)
                .stream()
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Target version not found: " + toVersion));

        String[] fromLines = from.getContent().split("\n", -1);
        String[] toLines = to.getContent().split("\n", -1);

        // LCS table
        int m = fromLines.length;
        int n = toLines.length;
        int[][] dp = new int[m + 1][n + 1];
        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                if (fromLines[i - 1].equals(toLines[j - 1])) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }

        // Backtrace to build diff operations
        List<DiffOperation> operations = new ArrayList<>();
        int i = m, j = n;
        List<DiffOperation> reversed = new ArrayList<>();
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && fromLines[i - 1].equals(toLines[j - 1])) {
                reversed.add(new DiffOperation("equal", j, fromLines[i - 1], toLines[j - 1]));
                i--;
                j--;
            } else if (j > 0 && (i == 0 || dp[i][j - 1] >= dp[i - 1][j])) {
                reversed.add(new DiffOperation("add", j, null, toLines[j - 1]));
                j--;
            } else if (i > 0) {
                reversed.add(new DiffOperation("remove", i, fromLines[i - 1], null));
                i--;
            }
        }
        for (int k = reversed.size() - 1; k >= 0; k--) {
            operations.add(reversed.get(k));
        }

        // Similarity
        int lcsLen = dp[m][n];
        int total = Math.max(m, n);
        float similarity = total > 0 ? (float) lcsLen / total : 1.0f;

        // Change summary
        int linesAdded = 0, linesRemoved = 0, linesModified = 0;
        for (DiffOperation op : operations) {
            switch (op.getOpType()) {
                case "add" -> linesAdded++;
                case "remove" -> linesRemoved++;
                case "equal" -> { /* unchanged */ }
            }
        }
        // Lines present in both but at different positions count as modified
        linesModified = lcsLen > 0 ? Math.max(m, n) - lcsLen - linesAdded - linesRemoved : 0;
        if (linesModified < 0) linesModified = 0;

        int wordCountDelta = countWords(to.getContent()) - countWords(from.getContent());

        return new VersionDiffResponse(
                fromVersion,
                toVersion,
                operations,
                similarity,
                new ChangeSummary(linesAdded, linesRemoved, linesModified, wordCountDelta)
        );
    }

    private int countWords(String text) {
        if (text == null || text.isEmpty()) return 0;
        String clean = text.replaceAll("<[^>]*>", "");
        int count = 0;
        boolean inWord = false;
        for (char c : clean.toCharArray()) {
            if (Character.isLetterOrDigit(c)) {
                if (!inWord) { count++; inWord = true; }
            } else if (Character.isWhitespace(c)) {
                inWord = false;
            } else if (Character.isIdeographic(c)) {
                count++;
                inWord = false;
            }
        }
        return Math.max(count, 1);
    }
}
