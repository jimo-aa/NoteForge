package com.noteforge.note.controller;

import com.noteforge.common.response.ApiResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.HashMap;
import java.util.Map;

@RestController
public class HealthController {

    @Autowired(required = false)
    private DataSource dataSource;

    @Autowired(required = false)
    private RedisConnectionFactory redisConnectionFactory;

    @GetMapping("/api/v1/notes/health")
    public ResponseEntity<ApiResponse<Map<String, Object>>> health() {
        Map<String, Object> result = new HashMap<>();
        result.put("status", "UP");
        result.put("service", "note-service");
        result.put("version", "0.1.0");

        // Check PostgreSQL
        try (Connection conn = dataSource.getConnection()) {
            result.put("postgresql", "UP");
        } catch (Exception e) {
            result.put("postgresql", "DOWN: " + e.getMessage());
            result.put("status", "DEGRADED");
        }

        // Check Redis
        if (redisConnectionFactory != null) {
            try (var connection = redisConnectionFactory.getConnection()) {
                connection.ping();
                result.put("redis", "UP");
            } catch (Exception e) {
                result.put("redis", "DOWN: " + e.getMessage());
                result.put("status", "DEGRADED");
            }
        } else {
            result.put("redis", "NOT_CONFIGURED");
        }

        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
