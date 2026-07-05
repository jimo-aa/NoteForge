package com.noteforge.user.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.concurrent.TimeUnit;

/**
 * Redis-backed token blacklist for logged-out / revoked access tokens.
 * Tokens are auto-evicted by Redis TTL; no manual eviction needed.
 */
@Service
@RequiredArgsConstructor
public class TokenBlacklistService {

    private static final String KEY_PREFIX = "token:blacklist:";

    private final StringRedisTemplate redisTemplate;

    public void blacklist(String token, long expiryEpochMillis) {
        long ttl = expiryEpochMillis - Instant.now().toEpochMilli();
        if (ttl <= 0) return;
        redisTemplate.opsForValue().set(KEY_PREFIX + token, "1", ttl, TimeUnit.MILLISECONDS);
    }

    public boolean isBlacklisted(String token) {
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(KEY_PREFIX + token));
        } catch (Exception e) {
            // Redis unavailable — treat as not blacklisted (fail open for auth)
            return false;
        }
    }

    /** No-op — Redis handles TTL eviction automatically */
    public void evictExpired() {
        // Redis TTL handles eviction
    }
}
