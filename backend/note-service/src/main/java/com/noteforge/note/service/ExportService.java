package com.noteforge.note.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.noteforge.note.dto.NoteResponse;
import com.noteforge.note.dto.NotebookResponse;
import com.noteforge.note.entity.NoteEntity;
import com.noteforge.note.exception.ResourceNotFoundException;
import com.noteforge.note.repository.NoteRepository;
import com.noteforge.note.repository.NotebookRepository;
import lombok.RequiredArgsConstructor;
import org.commonmark.node.Node;
import org.commonmark.parser.Parser;
import org.commonmark.renderer.html.HtmlRenderer;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Service for exporting notes and notebooks in various formats.
 */
@Service
@RequiredArgsConstructor
public class ExportService {

    private final NoteRepository noteRepository;
    private final NotebookRepository notebookRepository;
    private final NoteService noteService;
    private final NotebookService notebookService;
    private final ObjectMapper objectMapper;

    private final Parser markdownParser = Parser.builder().build();
    private final HtmlRenderer htmlRenderer = HtmlRenderer.builder().build();

    /**
     * Export a single note as raw Markdown.
     */
    public byte[] exportNoteAsMarkdown(String noteId, String userId) {
        NoteResponse note = noteService.getNote(noteId, userId);
        return note.getContent().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    /**
     * Export a single note as HTML (rendered from Markdown).
     */
    public byte[] exportNoteAsHtml(String noteId, String userId) {
        NoteResponse note = noteService.getNote(noteId, userId);
        String bodyHtml = renderMarkdown(note.getContent());

        String html = """
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>%s</title>
                <style>
                    body { max-width: 800px; margin: 0 auto; padding: 2em 1em;
                           font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                           line-height: 1.8; color: #333; }
                    pre { background: #f5f5f5; padding: 1em; border-radius: 4px; overflow-x: auto; }
                    code { background: #f0f0f0; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
                    img { max-width: 100%%; height: auto; }
                    table { border-collapse: collapse; width: 100%%; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background: #f5f5f5; }
                    blockquote { border-left: 4px solid #ddd; margin-left: 0; padding-left: 1em; color: #666; }
                </style>
            </head>
            <body>
                <h1>%s</h1>
                <hr>
                %s
            </body>
            </html>
            """.formatted(
                escapeHtml(note.getTitle()),
                escapeHtml(note.getTitle()),
                bodyHtml
            );

        return html.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    /**
     * Export a single note as pretty-printed JSON.
     */
    public byte[] exportNoteAsJson(String noteId, String userId) {
        try {
            NoteResponse note = noteService.getNote(noteId, userId);
            objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
            String json = objectMapper.writeValueAsString(note);
            return json.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize note to JSON", e);
        }
    }

    /**
     * Export all notes in a notebook as concatenated Markdown.
     */
    public byte[] exportNotebookAsMarkdown(String notebookId, String userId) {
        NotebookResponse notebook = notebookService.getNotebook(notebookId, userId);
        List<NoteEntity> notes = noteRepository
                .findByUserIdAndNotebookIdAndIsDeletedFalseOrderByUpdatedAtDesc(userId, notebookId);

        StringBuilder md = new StringBuilder();
        md.append("# ").append(notebook.getName()).append("\n\n");

        for (NoteEntity note : notes) {
            md.append("## ").append(note.getTitle()).append("\n\n");
            md.append(note.getContent());
            if (!note.getContent().endsWith("\n")) md.append("\n");
            md.append("\n---\n\n");
        }

        return md.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    /**
     * Export all notes in a notebook as pretty-printed JSON.
     */
    public byte[] exportNotebookAsJson(String notebookId, String userId) {
        try {
            NotebookResponse notebook = notebookService.getNotebook(notebookId, userId);
            List<NoteResponse> notes = noteService.listNotes(userId, notebookId, 0, 1000);

            var export = java.util.Map.of(
                "notebook", notebook,
                "notes", notes
            );

            objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
            String json = objectMapper.writeValueAsString(export);
            return json.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize notebook to JSON", e);
        }
    }

    // ── Helpers ──

    private String renderMarkdown(String markdown) {
        Node document = markdownParser.parse(markdown != null ? markdown : "");
        return htmlRenderer.render(document);
    }

    private String escapeHtml(String text) {
        if (text == null) return "";
        return text
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
