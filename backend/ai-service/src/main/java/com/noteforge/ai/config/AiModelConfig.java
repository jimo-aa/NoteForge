package com.noteforge.ai.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "ai")
public class AiModelConfig {
    private String provider = "openai";
    private OpenAiConfig openai = new OpenAiConfig();
    private ClaudeConfig claude = new ClaudeConfig();
    private EmbeddingConfig embedding = new EmbeddingConfig();
    private RateLimitConfig rateLimit = new RateLimitConfig();

    @Data
    public static class OpenAiConfig {
        private String apiKey = "";
        private String model = "gpt-4o-mini";
        private String endpoint = "https://api.openai.com/v1";
        private int maxTokens = 2048;
        private double temperature = 0.7;
    }

    @Data
    public static class ClaudeConfig {
        private String apiKey = "";
        private String model = "claude-3-haiku-20240307";
        private String endpoint = "https://api.anthropic.com/v1";
        private int maxTokens = 2048;
    }

    @Data
    public static class EmbeddingConfig {
        private String model = "text-embedding-3-small";
        private int dimension = 1536;
    }

    @Data
    public static class RateLimitConfig {
        private int tokensPerMinute = 100000;
        private int requestsPerMinute = 60;
    }
}
