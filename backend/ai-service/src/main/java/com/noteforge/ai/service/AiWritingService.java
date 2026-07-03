package com.noteforge.ai.service;

import com.noteforge.ai.client.LlmClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;

/**
 * AI writing service: continue, rewrite, translate, and complete text.
 * Uses prompt engineering to get high-quality results from any LLM.
 */
@Service
public class AiWritingService {
    private static final Logger log = LoggerFactory.getLogger(AiWritingService.class);

    private final LlmClient llmClient;

    public AiWritingService(LlmClient llmClient) {
        this.llmClient = llmClient;
    }

    /**
     * Continue writing from the given text.
     */
    public Flux<String> continueWriting(String text, String context) {
        String prompt = buildContinuePrompt(text, context);
        return llmClient.chat(List.of(
                Map.of("role", "system", "content", systemPrompt()),
                Map.of("role", "user", "content", prompt)
        ), true);
    }

    /**
     * Rewrite the given text with improved style/clarity.
     */
    public Flux<String> rewriteText(String text, String tone) {
        String prompt = buildRewritePrompt(text, tone);
        return llmClient.chat(List.of(
                Map.of("role", "system", "content", systemPrompt()),
                Map.of("role", "user", "content", prompt)
        ), true);
    }

    /**
     * Translate text to the target language.
     */
    public Flux<String> translateText(String text, String targetLang) {
        String prompt = buildTranslatePrompt(text, targetLang);
        return llmClient.chat(List.of(
                Map.of("role", "system", "content", "You are a professional translator. Translate accurately and naturally. Preserve Markdown formatting."),
                Map.of("role", "user", "content", prompt)
        ), true);
    }

    /**
     * Complete a partial sentence/paragraph (single response, no streaming needed for short completions).
     */
    public Flux<String> completeText(String text, int maxTokens) {
        return llmClient.chat(List.of(
                Map.of("role", "system", "content", "Complete the text naturally. Return only the continuation, nothing else."),
                Map.of("role", "user", "content", text)
        ), true);
    }

    // ── Prompt builders ──

    private String systemPrompt() {
        return """
                You are NoteForge AI, an intelligent writing assistant integrated into a note-taking app.
                You write in the user's language (detect from context).
                - Output Markdown format
                - Be concise and clear
                - Match the tone and style of the existing text
                - Return ONLY the generated content, no explanations or meta-commentary
                """.stripIndent();
    }

    private String buildContinuePrompt(String text, String context) {
        StringBuilder sb = new StringBuilder();
        if (context != null && !context.isBlank()) {
            sb.append("Context (previous content of the note):\n---\n").append(context).append("\n---\n\n");
        }
        sb.append("Continue writing from where the following text ends. Match the style and tone exactly:\n---\n");
        sb.append(text).append("\n---");
        return sb.toString();
    }

    private String buildRewritePrompt(String text, String tone) {
        String toneInstruction = switch (tone != null ? tone : "clear") {
            case "academic" -> "Use academic and formal language with precise terminology.";
            case "simple" -> "Use simple, easy-to-understand language suitable for a general audience.";
            case "professional" -> "Use professional business language, clear and direct.";
            case "creative" -> "Use creative and engaging language with vivid descriptions.";
            default -> "Use clear, natural language that is easy to read.";
        };
        return "Rewrite the following text to improve its quality.\n" + toneInstruction + "\n\nText:\n---\n" + text + "\n---";
    }

    private String buildTranslatePrompt(String text, String targetLang) {
        String langName = switch (targetLang != null ? targetLang : "zh-CN") {
            case "zh-CN" -> "Simplified Chinese (中文)";
            case "en-US" -> "English";
            case "ja" -> "Japanese (日本語)";
            case "ko" -> "Korean (한국어)";
            case "fr" -> "French";
            case "de" -> "German";
            case "es" -> "Spanish";
            default -> targetLang;
        };
        return "Translate the following text to " + langName + ". Preserve all Markdown formatting.\n\nText:\n---\n" + text + "\n---";
    }
}
