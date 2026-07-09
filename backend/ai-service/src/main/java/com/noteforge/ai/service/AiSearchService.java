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
import java.util.concurrent.ConcurrentHashMap;

/**
 * Hybrid search service combining vector similarity (BM25) full-text search.
 * Uses the existing embedding infrastructure to enable semantic search across notes.
 */
@Service
public class AiSearchService {
    private static final Logger log = LoggerFactory.getLogger(AiSearchService.class);

    private static final int EMBED_CACHE_MAX = 256;
    private static final int RRF_K = 60;

    private final LlmClient llmClient;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    /** LRU-like query embedding cache (query text → embedding vector). */
    private final Map<String, float[]> embedCache = new ConcurrentHashMap<>();

    public AiSearchService(LlmClient llmClient, JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.llmClient = llmClient;
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * Clear the query embedding cache (useful for testing or when model changes).
     */
    public void clearEmbeddingCache() {
        embedCache.clear();
        log.info("Query embedding cache cleared");
    }

    /**
     * Get embedding from cache or compute via LLM client.
     */
    private float[] getOrEmbed(String query) {
        // Evict oldest if at capacity
        if (embedCache.size() >= EMBED_CACHE_MAX) {
            // Simple eviction: clear all (acceptable for MVP)
            embedCache.clear();
            log.debug("Embedding cache full, cleared");
        }
        return embedCache.computeIfAbsent(query, q -> {
            float[] emb = llmClient.embed(q);
            log.debug("Computed embedding for query (length={})", emb.length);
            return emb;
        });
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
     * Result holder with total count for paginated search.
     */
    public static class SearchResultWithTotal {
        public List<Map<String, Object>> results;
        public int total;

        public SearchResultWithTotal(List<Map<String, Object>> results, int total) {
            this.results = results;
            this.total = total;
        }
    }

    /**
     * Perform hybrid search combining vector similarity and full-text.
     *
     * @param query     Search query text
     * @param mode      Search mode: "semantic", "fulltext", or "hybrid"
     * @param limit     Max results
     * @param offset    Pagination offset
     * @return SearchResultWithTotal with results and accurate total count
     */
    public SearchResultWithTotal search(String query, String mode, int limit, int offset) {
        if (query == null || query.isBlank()) return new SearchResultWithTotal(List.of(), 0);

        try {
            return switch (mode != null ? mode : "hybrid") {
                case "semantic" -> semanticSearch(query, limit, offset);
                case "fulltext" -> fulltextSearch(query, limit, offset);
                default -> hybridSearch(query, limit, offset);
            };
        } catch (Exception e) {
            log.error("Search failed: {}", e.getMessage());
            return new SearchResultWithTotal(List.of(), 0);
        }
    }

    /**
     * Pure vector similarity search using pgvector.
     */
    private SearchResultWithTotal semanticSearch(String query, int limit, int offset) {
        float[] queryEmbedding = getOrEmbed(query);
        if (queryEmbedding.length == 0) return new SearchResultWithTotal(List.of(), 0);

        String vectorStr = arrayToPgvector(queryEmbedding);

        // Get total count first
        String countSql = """
            SELECT COUNT(*) FROM notes 
            WHERE embedding IS NOT NULL AND is_deleted = 0
            """;
        Integer total = jdbcTemplate.queryForObject(countSql, Integer.class);

        String sql = """
            SELECT id, title, content_plain, 
                   1 - (embedding <=> ?::vector) AS similarity
            FROM notes 
            WHERE embedding IS NOT NULL AND is_deleted = 0
            ORDER BY similarity DESC
            LIMIT ? OFFSET ?
            """;

        List<Map<String, Object>> results = jdbcTemplate.query(sql, 
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
        return new SearchResultWithTotal(results, total != null ? total : results.size());
    }

    /**
     * PostgreSQL full-text search (tsvector).
     */
    private SearchResultWithTotal fulltextSearch(String query, int limit, int offset) {
        String tsquery = Arrays.stream(query.toLowerCase().split("\\s+"))
            .filter(w -> w.length() > 1)
            .map(w -> w + ":*")
            .reduce((a, b) -> a + " & " + b)
            .orElse(query);

        // Get total count
        String countSql = """
            SELECT COUNT(*) FROM notes
            WHERE is_deleted = 0
              AND to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content_plain,'')) @@ to_tsquery('simple', ?)
            """;
        Integer total = jdbcTemplate.queryForObject(countSql, Integer.class, tsquery);

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

        List<Map<String, Object>> results = jdbcTemplate.query(sql,
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
        return new SearchResultWithTotal(results, total != null ? total : results.size());
    }

    /**
     * Hybrid search using Reciprocal Rank Fusion (RRF).
     * Combines semantic and full-text rankings instead of raw score weighting.
     */
    private SearchResultWithTotal hybridSearch(String query, int limit, int offset) {
        // Fetch full result sets (no pagination yet — we need all for RRF merge)
        SearchResultWithTotal semanticResult = semanticSearch(query, Math.max(limit, 20) + offset, 0);
        SearchResultWithTotal fulltextResult = fulltextSearch(query, Math.max(limit, 20) + offset, 0);

        List<Map<String, Object>> semanticResults = semanticResult.results;
        List<Map<String, Object>> fulltextResults = fulltextResult.results;

        // RRF: score = sum of 1/(k + rank(i)) for each result list
        Map<String, Map<String, Object>> merged = new LinkedHashMap<>();

        int rank = 1;
        for (Map<String, Object> item : semanticResults) {
            String noteId = (String) item.get("noteId");
            item.put("rrfScore", 1.0 / (RRF_K + rank));
            item.put("semanticRank", rank);
            merged.put(noteId, item);
            rank++;
        }

        rank = 1;
        for (Map<String, Object> item : fulltextResults) {
            String noteId = (String) item.get("noteId");
            double rrfContribution = 1.0 / (RRF_K + rank);
            if (merged.containsKey(noteId)) {
                Map<String, Object> existing = merged.get(noteId);
                double existingRrf = (Double) existing.getOrDefault("rrfScore", 0.0);
                existing.put("rrfScore", existingRrf + rrfContribution);
                existing.put("fulltextRank", rank);
                existing.put("score", existingRrf + rrfContribution);
            } else {
                item.put("rrfScore", rrfContribution);
                item.put("semanticRank", 0);
                item.put("score", rrfContribution);
                merged.put(noteId, item);
            }
            rank++;
        }

        // Sort by RRF score descending
        List<Map<String, Object>> sorted = new ArrayList<>(merged.values());
        sorted.sort((a, b) -> Double.compare((Double) b.get("rrfScore"), (Double) a.get("rrfScore")));

        int total = sorted.size();
        // Also use the larger of the two totals as the best estimate
        int estimatedTotal = Math.max(semanticResult.total, fulltextResult.total);

        // Apply pagination
        int from = Math.min(offset, total);
        int to = Math.min(offset + limit, total);
        return new SearchResultWithTotal(sorted.subList(from, to), estimatedTotal);
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
