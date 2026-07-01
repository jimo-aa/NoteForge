package com.noteforge.user.service;

import jakarta.annotation.PostConstruct;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory token blacklist for logged-out / revoked access tokens.
 * Tokens are evicted automatically after their natural expiry.
 * Upgrade to Redis-backed when scaling beyond single instance.
 */
@Service
public class TokenBlacklistService {

    /** token -> expiry epoch millis */
    private final ConcurrentHashMap<String, Long> blacklist = new ConcurrentHashMap<>();

    public void blacklist(String token, long expiryEpochMillis) {
        blacklist.put(token, expiryEpochMillis);
    }

    public boolean isBlacklisted(String token) {
        Long expiry = blacklist.get(token);
        if (expiry == null) return false;
        if (Instant.now().toEpochMilli() >= expiry) {
            blacklist.remove(token);
            return false;
        }
        return true;
    }

    /** Evict expired entries every 5 minutes */
    @Scheduled(fixedRate = 300_000)
    public void evictExpired() {
        long now = Instant.now().toEpochMilli();
        blacklist.values().removeIf(expiry -> now >= expiry);
    }
}
