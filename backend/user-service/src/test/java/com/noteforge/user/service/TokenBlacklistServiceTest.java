package com.noteforge.user.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class TokenBlacklistServiceTest {

    private TokenBlacklistService service;

    @BeforeEach
    void setUp() {
        service = new TokenBlacklistService();
    }

    @Test
    void blacklist_shouldMarkTokenAsBlacklisted() {
        String token = "test-jwt-token";
        long futureExpiry = Instant.now().toEpochMilli() + 60_000;
        service.blacklist(token, futureExpiry);
        assertTrue(service.isBlacklisted(token));
    }

    @Test
    void isBlacklisted_shouldReturnFalseForUnknownToken() {
        assertFalse(service.isBlacklisted("unknown-token"));
    }

    @Test
    void isBlacklisted_shouldReturnFalseForExpiredBlacklistEntry() throws InterruptedException {
        // Blacklist with a 0ms expiry (immediately expired)
        service.blacklist("expired-token", Instant.now().toEpochMilli());
        // Ensure the expiry has passed
        Thread.sleep(10);
        assertFalse(service.isBlacklisted("expired-token"));
    }

    @Test
    void evictExpired_shouldRemoveExpiredEntries() {
        service.blacklist("token-1", Instant.now().toEpochMilli() + 10_000);
        service.blacklist("token-2", Instant.now().toEpochMilli() - 1); // already expired
        service.evictExpired();
        assertTrue(service.isBlacklisted("token-1"));
        assertFalse(service.isBlacklisted("token-2"));
    }
}
