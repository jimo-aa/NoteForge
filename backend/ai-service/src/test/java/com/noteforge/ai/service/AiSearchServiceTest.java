package com.noteforge.ai.service;

import com.noteforge.ai.client.LlmClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AiSearchServiceTest {

    @Mock
    private LlmClient llmClient;
    @Mock
    private JdbcTemplate jdbcTemplate;
    @Mock
    private ObjectMapper objectMapper;

    private AiSearchService searchService;

    @BeforeEach
    void setUp() {
        searchService = new AiSearchService(llmClient, jdbcTemplate, objectMapper);
    }

    @Test
    void testEmptyQueryReturnsEmpty() {
        AiSearchService.SearchResultWithTotal result = searchService.search(null, "hybrid", 10, 0);
        assertNotNull(result);
        assertTrue(result.results.isEmpty());
        assertEquals(0, result.total);

        result = searchService.search("", "semantic", 10, 0);
        assertTrue(result.results.isEmpty());
        assertEquals(0, result.total);
    }

    @Test
    void testClearEmbeddingCache() {
        // verify clearEmbeddingCache() doesn't throw
        assertDoesNotThrow(() -> searchService.clearEmbeddingCache());
    }

    @Test
    void testIndexNoteEmbedding() {
        when(llmClient.embed(anyString())).thenReturn(new float[]{1.0f, 2.0f});
        when(jdbcTemplate.update(anyString(), anyString(), anyString())).thenReturn(1);

        searchService.indexNoteEmbedding("note1", "Test Title", "Test content");

        verify(llmClient).embed(anyString());
        verify(jdbcTemplate).update(contains("UPDATE notes"), anyString(), eq("note1"));
    }

    @Test
    void testRemoveNoteEmbedding() {
        when(jdbcTemplate.update(anyString(), anyString())).thenReturn(1);

        searchService.removeNoteEmbedding("note1");

        verify(jdbcTemplate).update(contains("UPDATE notes"), eq("note1"));
    }

    @Test
    void testIndexNoteEmbeddingEmptyEmbedding() {
        when(llmClient.embed(anyString())).thenReturn(new float[0]);

        searchService.indexNoteEmbedding("note1", "Title", "Content");

        verify(llmClient).embed(anyString());
        // Should NOT call jdbcTemplate.update if embedding is empty
        verify(jdbcTemplate, never()).update(contains("UPDATE notes"), anyString(), anyString());
    }

    @Test
    void testEnsureEmbeddingColumn() {
        // execute() returns void, just verify it was called
        searchService.ensureEmbeddingColumn();

        verify(jdbcTemplate, times(2)).execute(anyString());
    }

    @Test
    void testGetIndexedCount() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class))).thenReturn(42);

        int count = searchService.getIndexedCount();

        assertEquals(42, count);
    }
}
