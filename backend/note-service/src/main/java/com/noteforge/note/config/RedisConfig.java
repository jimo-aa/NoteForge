package com.noteforge.note.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableCaching
@ConditionalOnProperty(name = "spring.cache.type", havingValue = "redis", matchIfMissing = false)
public class RedisConfig {
    // Redis 缓存配置 — 启用 @Cacheable / @CacheEvict 注解
    // 详细配置见 application.yml 中 spring.cache.redis 和 spring.data.redis
    // TODO: configure RedisTemplate / CacheManager if custom serialization needed
}
