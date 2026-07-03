package com.noteforge.ai.controller;

import com.noteforge.ai.service.AiWritingService;
import com.noteforge.ai.service.AiTagService;
import com.noteforge.ai.service.AiEmbeddingService;
import com.noteforge.ai.service.AiSearchService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.publisher.Flux;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController
@RequestMapping("/api/v1/ai")
public class AiController {
    private static final Logger log = LoggerFactory.getLogger(AiController.class);

    private final AiWritingService writingService;
    private final AiTagService tagService;
    private final AiEmbeddingService embeddingService;
    private final AiSearchService searchService;
    private final ExecutorService executor = Executors.newCachedThreadPool();

    public AiController(AiWritingService writingService, AiTagService tagService, AiEmbeddingService embeddingService, AiSearchService searchService) {
        this.writingService = writingService;
        this.tagService = tagService;
        this.embeddingService = embeddingService;
        this.searchService = searchService;
    }

    /**
     * AI writing: continue, rewrite, translate — streaming via SSE.
     *
     * @param request { action: "continue"|"rewrite"|"translate", text, context?, tone?, targetLang? }
     * @return SseEmitter streaming the AI response
     */
    @PostMapping(value = "/write", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter write(@RequestBody Map<String, Object> request) {
        String action = (String) request.getOrDefault("action", "continue");
        String text = (String) request.getOrDefault("text", "");
        String context = (String) request.getOrDefault("context", null);
        String tone = (String) request.getOrDefault("tone", "clear");
        String targetLang = (String) request.getOrDefault("targetLang", "zh-CN");

        if (text == null || text.isBlank()) {
            SseEmitter errorEmitter = new SseEmitter(0L);
            try { errorEmitter.send(SseEmitter.event().name("error").data("{\"error\":\"text is required\"}")); } catch (IOException ignored) {}
            errorEmitter.complete();
            return errorEmitter;
        }

        SseEmitter emitter = new SseEmitter(60_000L); // 60s timeout

        Flux<String> resultFlux = switch (action) {
            case "rewrite" -> writingService.rewriteText(text, tone);
            case "translate" -> writingService.translateText(text, targetLang);
            case "complete" -> writingService.completeText(text, 1024);
            default -> writingService.continueWriting(text, context);
        };

        executor.execute(() -> {
            try {
                StringBuilder fullContent = new StringBuilder();
                resultFlux.subscribe(
                        chunk -> {
                            try {
                                fullContent.append(chunk);
                                emitter.send(SseEmitter.event()
                                        .name("delta")
                                        .data("{\"content\":" + escape(chunk) + "}"));
                            } catch (IOException e) {
                                log.warn("SSE send failed (client disconnected): {}", e.getMessage());
                            }
                        },
                        error -> {
                            try {
                                emitter.send(SseEmitter.event()
                                        .name("error")
                                        .data("{\"error\":" + escape(error.getMessage()) + "}"));
                            } catch (IOException ignored) {}
                            emitter.complete();
                        },
                        () -> {
                            try {
                                emitter.send(SseEmitter.event()
                                        .name("done")
                                        .data("{\"content\":" + escape(fullContent.toString()) + ",\"tokens\":0}"));
                            } catch (IOException ignored) {}
                            emitter.complete();
                        }
                );
            } catch (Exception e) {
                try {
                    emitter.send(SseEmitter.event().name("error").data("{\"error\":" + escape(e.getMessage()) + "}"));
                } catch (IOException ignored) {}
                emitter.complete();
            }
        });

        return emitter;
    }

    /**
     * Suggest tags for a note — returns immediately (not streaming).
     */
    @PostMapping("/tag")
    public ResponseEntity<Map<String, Object>> suggestTags(@RequestBody Map<String, Object> request) {
        String title = (String) request.getOrDefault("title", "");
        String content = (String) request.getOrDefault("content", "");
        @SuppressWarnings("unchecked")
        List<String> existingTags = (List<String>) request.getOrDefault("existingTags", List.of());

        List<String> tags = tagService.suggestTags(title, content, existingTags);
        return ResponseEntity.ok(Map.of("code", 0, "data", Map.of("tags", tags)));
    }

    /**
     * Create an embedding for semantic search.
     */
    @PostMapping("/embed")
    public ResponseEntity<Map<String, Object>> embed(@RequestBody Map<String, Object> request) {
        String text = (String) request.getOrDefault("text", "");
        float[] embedding = embeddingService.createEmbedding(text);

        // Convert float[] to List for JSON serialization
        List<Double> embeddingList = new java.util.ArrayList<>();
        for (float v : embedding) {
            embeddingList.add((double) v);
        }
        return ResponseEntity.ok(Map.of("code", 0, "data", Map.of("embedding", embeddingList, "dimension", embedding.length)));
    }

    /**
     * Hybrid search: combines vector similarity (pgvector) with full-text search.
     *
     * @param request { query, mode: "semantic"|"fulltext"|"hybrid", limit?, offset? }
     * @return { results: [{ noteId, title, snippet, score }], total }
     */
    @PostMapping("/search")
    public ResponseEntity<Map<String, Object>> search(@RequestBody Map<String, Object> request) {
        String query = (String) request.getOrDefault("query", "");
        String mode = (String) request.getOrDefault("mode", "hybrid");
        int limit = (int) request.getOrDefault("limit", 20);
        int offset = (int) request.getOrDefault("offset", 0);

        if (query == null || query.isBlank()) {
            return ResponseEntity.ok(Map.of("code", 0, "data", Map.of("results", List.of(), "total", 0)));
        }

        List<Map<String, Object>> results = searchService.search(query, mode, limit, offset);
        return ResponseEntity.ok(Map.of("code", 0, "data", Map.of("results", results, "total", results.size())));
    }

    /**
     * Initialize search index: ensure pgvector column and index notes.
     * POST /api/v1/ai/search/init
     * Body: { noteId, title, content } or { notes: [...] }
     */
    @PostMapping("/search/init")
    public ResponseEntity<Map<String, Object>> initIndex(@RequestBody Map<String, Object> request) {
        searchService.ensureEmbeddingColumn();

        // Index a single note
        if (request.containsKey("noteId")) {
            String noteId = (String) request.get("noteId");
            String title = (String) request.getOrDefault("title", "");
            String content = (String) request.getOrDefault("content", "");
            searchService.indexNoteEmbedding(noteId, title, content);
            return ResponseEntity.ok(Map.of("code", 0, "message", "Note indexed"));
        }

        // Index multiple notes
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> notes = (List<Map<String, Object>>) request.get("notes");
        if (notes != null) {
            for (Map<String, Object> note : notes) {
                searchService.indexNoteEmbedding(
                    (String) note.get("noteId"),
                    (String) note.getOrDefault("title", ""),
                    (String) note.getOrDefault("content", "")
                );
            }
            return ResponseEntity.ok(Map.of("code", 0, "message", notes.size() + " notes indexed"));
        }

        int count = searchService.getIndexedCount();
        return ResponseEntity.ok(Map.of("code", 0, "data", Map.of("indexedCount", count)));
    }

    /**
     * Health check.
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "ai-service",
                "provider", "openai-compatible"
        ));
    }

    private String escape(String s) {
        if (s == null) return "\"\"";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t") + "\"";
    }
}
