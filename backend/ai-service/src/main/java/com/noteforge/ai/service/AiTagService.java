package com.noteforge.ai.service;

import com.noteforge.ai.client.LlmClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Auto-tagging service: analyzes note content and suggests relevant tags.
 */
@Service
public class AiTagService {
    private static final Logger log = LoggerFactory.getLogger(AiTagService.class);

    private final LlmClient llmClient;
    private final ObjectMapper objectMapper;

    public AiTagService(LlmClient llmClient, ObjectMapper objectMapper) {
        this.llmClient = llmClient;
        this.objectMapper = objectMapper;
    }

    /**
     * Suggest tags for a note based on its title and content.
     *
     * @param title      Note title
     * @param content    Note content (Markdown)
     * @param existingTags Tags the user already has (for consistency)
     * @return List of suggested tag names (3-5 tags)
     */
    public List<String> suggestTags(String title, String content, List<String> existingTags) {
        String prompt = buildTagPrompt(title, content, existingTags);

        try {
            String response = llmClient.chatSync(List.of(
                    Map.of("role", "system", "content", "You are a smart tag suggestion engine. Analyze the note content and suggest 3-5 relevant tags. Return ONLY a JSON array of strings, no other text."),
                    Map.of("role", "user", "content", prompt)
            ));

            if (response == null || response.isBlank()) {
                return fallbackTags(title, content);
            }

            // Try to parse as JSON array
            try {
                JsonNode arr = objectMapper.readTree(response.trim());
                if (arr.isArray()) {
                    List<String> tags = new ArrayList<>();
                    for (JsonNode node : arr) {
                        if (node.isTextual()) {
                            tags.add(node.asText().toLowerCase().trim());
                        }
                    }
                    return tags.isEmpty() ? fallbackTags(title, content) : tags;
                }
            } catch (Exception e) {
                // Not JSON — try to extract tags from text
                List<String> extracted = extractTagsFromText(response);
                if (!extracted.isEmpty()) return extracted;
            }
        } catch (Exception e) {
            log.warn("AI tag suggestion failed: {}", e.getMessage());
        }

        return fallbackTags(title, content);
    }

    /**
     * Extract keywords from content as fallback when LLM is unavailable.
     */
    private List<String> fallbackTags(String title, String content) {
        Set<String> tags = new LinkedHashSet<>();

        // Extract words from title
        if (title != null && !title.isBlank()) {
            String[] words = title.toLowerCase().split("[\\s,，、\\-_:：()（）]+");
            for (String word : words) {
                word = word.trim();
                if (word.length() >= 2 && word.length() <= 20) {
                    tags.add(word);
                }
            }
        }

        // Look for common patterns in content
        if (content != null) {
            String lower = content.toLowerCase();
            if (lower.contains("TODO") || lower.contains("待办") || lower.contains("- [ ]")) {
                tags.add("todo");
            }
            if (lower.contains("idea") || lower.contains("想法") || lower.contains("灵感")) {
                tags.add("idea");
            }
            if (lower.contains("summary") || lower.contains("总结") || lower.contains("摘要")) {
                tags.add("summary");
            }
        }

        return tags.stream().limit(5).toList();
    }

    private String buildTagPrompt(String title, String content, List<String> existingTags) {
        StringBuilder sb = new StringBuilder();
        sb.append("Suggest 3-5 tags for this note.\n\n");
        sb.append("Title: ").append(title != null ? title : "").append("\n\n");
        sb.append("Content (first 2000 chars):\n").append(content != null ? content.substring(0, Math.min(content.length(), 2000)) : "").append("\n\n");
        if (existingTags != null && !existingTags.isEmpty()) {
            sb.append("Existing tags in the account (prefer these if relevant): ").append(String.join(", ", existingTags)).append("\n");
        }
        sb.append("\nReturn ONLY a JSON array of strings: [\"tag1\", \"tag2\", \"tag3\"]");
        return sb.toString();
    }

    private List<String> extractTagsFromText(String text) {
        List<String> tags = new ArrayList<>();
        // Match simple patterns like - tag, * tag, "tag", 'tag'
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("[\"']([a-zA-Z\\u4e00-\\u9fff\\-]+)[\"']").matcher(text);
        while (m.find() && tags.size() < 5) {
            String tag = m.group(1).toLowerCase().trim();
            if (tag.length() >= 2) tags.add(tag);
        }
        return tags;
    }
}
