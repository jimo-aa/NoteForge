package com.noteforge.note.controller;

import com.noteforge.note.entity.NoteEntity;
import com.noteforge.note.repository.NoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/notes")
@RequiredArgsConstructor
public class NoteController {

    private final NoteRepository noteRepository;

    @PostMapping
    public ResponseEntity<NoteEntity> createNote(@RequestBody NoteEntity note) {
        note.setId(null);
        note.setVersion(1);
        note.setDeleted(false);
        NoteEntity saved = noteRepository.save(note);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/{id}")
    public ResponseEntity<NoteEntity> getNote(@PathVariable String id) {
        return noteRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<NoteEntity> updateNote(
            @PathVariable String id,
            @RequestBody NoteEntity update) {
        return noteRepository.findById(id)
                .map(existing -> {
                    if (update.getTitle() != null) existing.setTitle(update.getTitle());
                    if (update.getContent() != null) {
                        existing.setContent(update.getContent());
                        existing.setContentPlain(stripHtml(update.getContent()));
                        existing.setWordCount(countWords(update.getContent()));
                    }
                    existing.setVersion(existing.getVersion() + 1);
                    return ResponseEntity.ok(noteRepository.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNote(@PathVariable String id) {
        return noteRepository.findById(id)
                .map(note -> {
                    note.setDeleted(true);
                    noteRepository.save(note);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<NoteEntity>> listNotes(
            @RequestParam String userId,
            @RequestParam(required = false) String notebookId) {
        List<NoteEntity> notes;
        if (notebookId != null) {
            notes = noteRepository
                    .findByUserIdAndNotebookIdAndIsDeletedFalseOrderByUpdatedAtDesc(userId, notebookId);
        } else {
            notes = noteRepository.findByUserIdAndIsDeletedFalseOrderByUpdatedAtDesc(userId);
        }
        return ResponseEntity.ok(notes);
    }

    private String stripHtml(String html) {
        return html.replaceAll("<[^>]*>", "");
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
