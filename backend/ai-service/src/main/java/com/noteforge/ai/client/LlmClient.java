package com.noteforge.ai.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.noteforge.ai.config.AiModelConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;

/**
 * LLM client supporting OpenAI-compatible and Claude APIs.
 * Default mode: OpenAI-compatible (works with OpenAI, together.ai, local Llamafile, etc.)
 */
@Component
public class LlmClient {
    private static final Logger log = LoggerFactory.getLogger(LlmClient.class);

    private final AiModelConfig config;
    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public LlmClient(AiModelConfig config, ObjectMapper objectMapper) {
        this.config = config;
        this.objectMapper = objectMapper;
        this.webClient = WebClient.builder().build();
    }

    /**
     * Send a chat completion request with streaming support.
     *
     * @param messages List of {role, content} maps
     * @param stream   Whether to stream the response
     * @return Flux of content chunks (each chunk is a string delta)
     */
    public Flux<String> chat(List<Map<String, String>> messages, boolean stream) {
        String apiKey = config.getOpenai().getApiKey();
        String endpoint = config.getOpenai().getEndpoint() + "/chat/completions";
        String model = config.getOpenai().getModel();

        if (apiKey == null || apiKey.isBlank()) {
            log.warn("OpenAI API key not configured; returning mock response");
            return Flux.just("[AI 功能需要配置 OPENAI_API_KEY 环境变量]");
        }

        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", model);
        body.put("stream", stream);
        body.put("max_tokens", config.getOpenai().getMaxTokens());
        body.put("temperature", config.getOpenai().getTemperature());

        ArrayNode messagesNode = body.putArray("messages");
        for (Map<String, String> msg : messages) {
            ObjectNode msgNode = messagesNode.addObject();
            msgNode.put("role", msg.getOrDefault("role", "user"));
            msgNode.put("content", msg.getOrDefault("content", ""));
        }

        if (stream) {
            return webClient.post()
                    .uri(endpoint)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToFlux(String.class)
                    .filter(line -> line.startsWith("data: "))
                    .map(line -> line.substring(6))
                    .filter(line -> !"[DONE]".equals(line.trim()))
                    .map(this::extractDelta)
                    .filter(delta -> delta != null && !delta.isEmpty());
        } else {
            return webClient.post()
                    .uri(endpoint)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .flatMapMany(response -> {
                        try {
                            JsonNode root = objectMapper.readTree(response);
                            String content = root.path("choices").get(0).path("message").path("content").asText("");
                            return Flux.just(content);
                        } catch (Exception e) {
                            log.error("Failed to parse LLM response: {}", e.getMessage());
                            return Flux.just("[解析 AI 响应失败]");
                        }
                    });
        }
    }

    /**
     * Non-streaming chat for simple requests (tagging, classification).
     */
    public String chatSync(List<Map<String, String>> messages) {
        return chat(messages, false).blockLast();
    }

    /**
     * Create embeddings for a text string using OpenAI-compatible embedding API.
     */
    public float[] embed(String text) {
        String apiKey = config.getOpenai().getApiKey();
        String endpoint = config.getOpenai().getEndpoint() + "/embeddings";
        String model = config.getEmbedding().getModel();

        if (apiKey == null || apiKey.isBlank()) {
            log.warn("OpenAI API key not configured for embeddings");
            return new float[config.getEmbedding().getDimension()];
        }

        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", model);
        body.put("input", text);

        try {
            String response = webClient.post()
                    .uri(endpoint)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode root = objectMapper.readTree(response);
            JsonNode embeddingNode = root.path("data").get(0).path("embedding");
            if (embeddingNode.isArray()) {
                float[] embedding = new float[embeddingNode.size()];
                for (int i = 0; i < embeddingNode.size(); i++) {
                    embedding[i] = (float) embeddingNode.get(i).asDouble();
                }
                return embedding;
            }
        } catch (Exception e) {
            log.error("Failed to create embedding: {}", e.getMessage());
        }
        return new float[config.getEmbedding().getDimension()];
    }

    private String extractDelta(String sseData) {
        try {
            JsonNode root = objectMapper.readTree(sseData);
            JsonNode delta = root.path("choices").get(0).path("delta").path("content");
            return delta.isTextual() ? delta.asText() : "";
        } catch (Exception e) {
            return "";
        }
    }
}
