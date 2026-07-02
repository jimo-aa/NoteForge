package com.noteforge.user.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Instant;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TokenBlacklistServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOps;

    private TokenBlacklistService service;

    @BeforeEach
    void setUp() {
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
        service = new TokenBlacklistService(redisTemplate);
    }

    @Test
    void blacklist_shouldStoreTokenInRedisWithTtl() {
        String token = "test-jwt-token";
        long futureExpiry = Instant.now().toEpochMilli() + 60_000;

        service.blacklist(token, futureExpiry);

        verify(valueOps).set(eq("token:blacklist:" + token), eq("1"), longThat(ttl -> ttl > 0 && ttl <= 60_000), eq(TimeUnit.MILLISECONDS));
    }

    @Test
    void blacklist_shouldSkip_whenTokenAlreadyExpired() {
        String token = "expired-token";
        long pastExpiry = Instant.now().toEpochMilli() - 1;

        service.blacklist(token, pastExpiry);

        verify(valueOps, never()).set(anyString(), anyString(), anyLong(), any(TimeUnit.class));
    }

    @Test
    void isBlacklisted_shouldReturnTrue_whenTokenExists() {
        String token = "blacklisted-token";
        when(redisTemplate.hasKey("token:blacklist:" + token)).thenReturn(true);

        assertTrue(service.isBlacklisted(token));
    }

    @Test
    void isBlacklisted_shouldReturnFalse_forUnknownToken() {
        String token = "unknown-token";
        when(redisTemplate.hasKey("token:blacklist:" + token)).thenReturn(false);

        assertFalse(service.isBlacklisted(token));
    }

    @Test
    void evictExpired_shouldBeNoOp() {
        // Redis handles TTL eviction; this method should not throw
        service.evictExpired();
        verifyNoInteractions(redisTemplate);
    }
}
