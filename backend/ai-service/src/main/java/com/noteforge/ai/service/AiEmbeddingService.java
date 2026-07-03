package com.noteforge.ai.service;

import com.noteforge.ai.client.LlmClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Embedding service for semantic search.
 * Converts text to vector embeddings using the configured LLM provider.
 */
@Service
public class AiEmbeddingService {
    private static final Logger log = LoggerFactory.getLogger(AiEmbeddingService.class);

    private final LlmClient llmClient;

    public AiEmbeddingService(LlmClient llmClient) {
        this.llmClient = llmClient;
    }

    /**
     * Create an embedding vector for the given text.
     */
    public float[] createEmbedding(String text) {
        if (text == null || text.isBlank()) {
            return new float[1536];
        }
        // Truncate to avoid token limits
        String truncated = text.length() > 8000 ? text.substring(0, 8000) : text;
        return llmClient.embed(truncated);
    }

    /**
     * Compute cosine similarity between two vectors.
     */
    public double cosineSimilarity(float[] a, float[] b) {
        if (a.length != b.length) return 0;
        double dot = 0, normA = 0, normB = 0;
        for (int i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        double denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom == 0 ? 0 : dot / denom;
    }
}
