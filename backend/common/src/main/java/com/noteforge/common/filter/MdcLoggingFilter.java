package com.noteforge.common.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * MDC请求日志过滤器 — 为每个请求生成追踪ID并记录请求/响应日志
 */
@Component
@Order(2)
public class MdcLoggingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(MdcLoggingFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String traceId = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String userId = request.getUserPrincipal() != null ? request.getUserPrincipal().getName() : "anonymous";

        MDC.put("traceId", traceId);
        MDC.put("userId", userId);
        MDC.put("method", request.getMethod());
        MDC.put("uri", request.getRequestURI());

        long startTime = System.currentTimeMillis();
        log.info("→ {} {}", request.getMethod(), request.getRequestURI());

        try {
            filterChain.doFilter(request, response);
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            int status = response.getStatus();
            log.info("← {} {} → {} ({}ms)", request.getMethod(), request.getRequestURI(), status, duration);
            MDC.clear();
        }
    }
}
