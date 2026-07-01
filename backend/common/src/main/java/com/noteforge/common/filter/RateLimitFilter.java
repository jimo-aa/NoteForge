package com.noteforge.common.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 简单的内存令牌桶限流过滤器
 * 按用户ID（已认证）或客户端IP（未认证）进行限流
 */
@Component
@Order(1)
@ConditionalOnProperty(name = "noteforge.rate-limit.enabled", havingValue = "true", matchIfMissing = false)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    @Value("${noteforge.rate-limit.capacity:100}")
    private int capacity;

    @Value("${noteforge.rate-limit.refill-per-second:10}")
    private int refillPerSecond;

    private final Map<String, TokenBucket> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        // Skip rate limiting for actuator and auth endpoints
        String path = request.getRequestURI();
        if (path.startsWith("/actuator") || path.startsWith("/api/v1/auth")) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientId = resolveClientId(request);
        TokenBucket bucket = buckets.computeIfAbsent(clientId, k -> new TokenBucket(capacity, refillPerSecond));

        if (bucket.tryConsume()) {
            filterChain.doFilter(request, response);
        } else {
            log.warn("Rate limit exceeded for client: {}", clientId);
            response.setStatus(429);
            response.setContentType("application/json");
            response.getWriter().write("{\"code\":429,\"message\":\"Too many requests. Please try again later.\",\"data\":null}");
        }
    }

    private String resolveClientId(HttpServletRequest request) {
        // Use authenticated user ID if available, otherwise fall back to IP
        String userId = request.getUserPrincipal() != null ? request.getUserPrincipal().getName() : null;
        if (userId != null) return userId;
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isEmpty()) return xff.split(",")[0].trim();
        return request.getRemoteAddr();
    }

    /**
     * Simple token bucket implementation
     */
    static class TokenBucket {
        private final int capacity;
        private final long refillIntervalNanos;
        private final AtomicLong tokens;
        private volatile long lastRefillNanos;

        TokenBucket(int capacity, int refillPerSecond) {
            this.capacity = capacity;
            this.refillIntervalNanos = 1_000_000_000L / refillPerSecond;
            this.tokens = new AtomicLong(capacity);
            this.lastRefillNanos = System.nanoTime();
        }

        boolean tryConsume() {
            refill();
            while (true) {
                long current = tokens.get();
                if (current <= 0) return false;
                if (tokens.compareAndSet(current, current - 1)) return true;
            }
        }

        private void refill() {
            long now = System.nanoTime();
            long elapsed = now - lastRefillNanos;
            if (elapsed < refillIntervalNanos) return;
            long tokensToAdd = elapsed / refillIntervalNanos;
            if (tokensToAdd > 0) {
                lastRefillNanos = now;
                tokens.updateAndGet(t -> Math.min(capacity, t + tokensToAdd));
            }
        }
    }
}
