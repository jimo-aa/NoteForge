package com.noteforge.note.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // TODO: register SyncWebSocketHandler when implementing real-time sync
        // registry.addHandler(syncWebSocketHandler(), "/ws/sync")
        //         .setAllowedOrigins("*");
    }
}
