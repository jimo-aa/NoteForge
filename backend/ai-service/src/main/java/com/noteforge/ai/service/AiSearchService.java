package com.noteforge.ai.service;

import com.noteforge.ai.client.LlmClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.ResultSet;
import java.util.*;

/**
 * Hybrid search service combining vector similarity (pgvector) with BM25 full-text search.
 * Uses the existing embedding infrastructure to enable semantic search across notes.
 */
@Service
public class AiSearchService {
    private static final Logger log = LoggerFactory.getLogger(AiSearchService.class);

    private final LlmClient llmClient;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public AiSearchService(LlmClient llmClient, JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.llmClient = llmClient;
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * Ensure the embedding column exists on the notes table.
     * Called on startup.
     */
    public void ensureEmbeddingColumn() {
        try {
            jdbcTemplate.execute("""
                ALTER TABLE notes ADD COLUMN IF NOT EXISTS embedding vector(1536)
                """);
            jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_notes_embedding 
                ON notes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
                """);
            log.info("pgvector embedding column + index ensured on notes table");
        } catch (Exception e) {
            log.warn("Failed to ensure embedding column (may not have permissions): {}", e.getMessage());
        }
    }

    /**
     * Compute and store embedding for a note.
     */
    public void indexNoteEmbedding(String noteId, String title, String content) {
        try {
            String text = (title != null ? title + " " : "") + (content != null ? content.substring(0, Math.min(content.length(), 4000)) : "");
            if (text.isBlank()) return;

            float[] embedding = llmClient.embed(text);
            if (embedding.length == 0) return;

            String vectorStr = arrayToPgvector(embedding);
            jdbcTemplate.update(
                "UPDATE notes SET embedding = ?::vector WHERE id = ?",
                vectorStr, noteId
            );
            log.debug("Stored embedding for note {}", noteId);
        } catch (Exception e) {
            log.warn("Failed to index embedding for note {}: {}", noteId, e.getMessage());
        }
    }

    /**
     * Remove embedding for a note (when deleted).
     */
    public void removeNoteEmbedding(String noteId) {
        try {
            jdbcTemplate.update("UPDATE notes SET embedding = NULL WHERE id = ?", noteId);
        } catch (Exception e) {
            log.warn("Failed to remove embedding for note {}: {}", noteId, e.getMessage());
        }
    }

    /**
     * Perform hybrid search combining vector similarity and full-text.
     *
     * @param query     Search query text
     * @param mode      Search mode: "semantic", "fulltext", or "hybrid"
     * @param limit     Max results
     * @param offset    Pagination offset
     * @return List of search results with scores
     */
    public List<Map<String, Object>> search(String query, String mode, int limit, int offset) {
        if (query == null || query.isBlank()) return List.of();

        List<Map<String, Object>> results = new ArrayList<>();

        try {
            switch (mode != null ? mode : "hybrid") {
                case "semantic" -> results = semanticSearch(query, limit, offset);
                case "fulltext" -> results = fulltextSearch(query, limit, offset);
                default -> results = hybridSearch(query, limit, offset);
            }
        } catch (Exception e) {
            log.error("Search failed: {}", e.getMessage());
        }

        return results;
    }

    /**
     * Pure vector similarity search using pgvector.
     */
    private List<Map<String, Object>> semanticSearch(String query, int limit, int offset) {
        float[] queryEmbedding = llmClient.embed(query);
        if (queryEmbedding.length == 0) return List.of();

        String vectorStr = arrayToPgvector(queryEmbedding);

        String sql = """
            SELECT id, title, content_plain, 
                   1 - (embedding <=> ?::vector) AS similarity
            FROM notes 
            WHERE embedding IS NOT NULL AND is_deleted = 0
            ORDER BY similarity DESC
            LIMIT ? OFFSET ?
            """;

        return jdbcTemplate.query(sql, 
            new Object[]{vectorStr, limit, offset},
            (ResultSet rs, int rowNum) -> {
                Map<String, Object> item = new HashMap<>();
                item.put("noteId", rs.getString("id"));
                item.put("title", rs.getString("title"));
                item.put("snippet", truncate(rs.getString("content_plain"), 200));
                item.put("score", rs.getDouble("similarity"));
                return item;
            }
        );
    }

    /**
     * PostgreSQL full-text search (tsvector).
     */
    private List<Map<String, Object>> fulltextSearch(String query, int limit, int offset) {
        // Use PostgreSQL ts_query for full-text search
        String tsquery = Arrays.stream(query.toLowerCase().split("\\s+"))
            .filter(w -> w.length() > 1)
            .map(w -> w + ":*")
            .reduce((a, b) -> a + " & " + b)
            .orElse(query);

        String sql = """
            SELECT id, title, content_plain,
                   ts_rank(to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content_plain,'')), 
                           to_tsquery('simple', ?)) AS relevance
            FROM notes
            WHERE is_deleted = 0
              AND to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content_plain,'')) @@ to_tsquery('simple', ?)
            ORDER BY relevance DESC
            LIMIT ? OFFSET ?
            """;

        return jdbcTemplate.query(sql,
            new Object[]{tsquery, tsquery, limit, offset},
            (ResultSet rs, int rowNum) -> {
                Map<String, Object> item = new HashMap<>();
                item.put("noteId", rs.getString("id"));
                item.put("title", rs.getString("title"));
                item.put("snippet", truncate(rs.getString("content_plain"), 200));
                item.put("score", rs.getDouble("relevance"));
                return item;
            }
        );
    }

    /**
     * Hybrid search: combines vector similarity and full-text scores.
     * Simple approach: run both searches and merge results.
     */
    private List<Map<String, Object>> hybridSearch(String query, int limit, int offset) {
        Map<String, Map<String, Object>> merged = new LinkedHashMap<>();
        double semanticWeight = 0.6;
        double fulltextWeight = 0.4;

        // Get semantic results
        List<Map<String, Object>> semanticResults = semanticSearch(query, limit + offset, 0);
        for (Map<String, Object> item : semanticResults) {
            String noteId = (String) item.get("noteId");
            item.put("semanticScore", item.get("score"));
            item.put("fulltextScore", 0.0);
            item.put("score", (Double) item.get("score") * semanticWeight);
            merged.put(noteId, item);
        }

        // Get full-text results and merge
        List<Map<String, Object>> fulltextResults = fulltextSearch(query, limit + offset, 0);
        for (Map<String, Object> item : fulltextResults) {
            String noteId = (String) item.get("noteId");
            double ftScore = (Double) item.get("score");
            if (merged.containsKey(noteId)) {
                Map<String, Object> existing = merged.get(noteId);
                existing.put("fulltextScore", ftScore);
                double semScore = (Double) existing.getOrDefault("semanticScore", 0.0);
                existing.put("score", semScore * semanticWeight + ftScore * fulltextWeight);
            } else {
                item.put("semanticScore", 0.0);
                item.put("fulltextScore", ftScore);
                item.put("score", ftScore * fulltextWeight);
                merged.put(noteId, item);
            }
        }

        // Sort by combined score descending
        List<Map<String, Object>> sorted = new ArrayList<>(merged.values());
        sorted.sort((a, b) -> Double.compare((Double) b.get("score"), (Double) a.get("score")));

        // Apply pagination
        int total = sorted.size();
        int from = Math.min(offset, total);
        int to = Math.min(offset + limit, total);
        return sorted.subList(from, to);
    }

    /**
     * Get total number of indexed notes (with embeddings).
     */
    public int getIndexedCount() {
        try {
            Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM notes WHERE embedding IS NOT NULL", Integer.class);
            return count != null ? count : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    // ── Helpers ──

    private String arrayToPgvector(float[] arr) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(arr[i]);
        }
        sb.append("]");
        return sb.toString();
    }

    private String truncate(String s, int maxLen) {
        if (s == null) return "";
        return s.length() <= maxLen ? s : s.substring(0, maxLen) + "...";
    }
}
