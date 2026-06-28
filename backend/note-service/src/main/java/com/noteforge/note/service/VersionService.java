package com.noteforge.note.service;

import com.noteforge.note.dto.VersionResponse;
import com.noteforge.note.entity.NoteVersionEntity;
import com.noteforge.note.exception.ResourceNotFoundException;
import com.noteforge.note.repository.NoteVersionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class VersionService {

    private final NoteVersionRepository noteVersionRepository;

    public VersionResponse createVersion(String noteId, String userId, String title, String content, String contentPlain) {
        List<NoteVersionEntity> existing = noteVersionRepository.findByNoteIdAndUserIdOrderByVersionNumberDesc(noteId, userId);
        int nextVersion = existing.isEmpty() ? 1 : existing.get(0).getVersionNumber() + 1;

        NoteVersionEntity entity = new NoteVersionEntity();
        entity.setNoteId(noteId);
        entity.setUserId(userId);
        entity.setVersionNumber(nextVersion);
        entity.setTitle(title);
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
}
