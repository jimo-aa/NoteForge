package com.noteforge.note.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.elasticsearch.client.ClientConfiguration;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchConfiguration;

@Configuration
@ConditionalOnProperty(name = "elasticsearch.enabled", havingValue = "true")
public class ElasticsearchConfig extends ElasticsearchConfiguration {

    private final String host;
    private final int port;

    public ElasticsearchConfig(
            @org.springframework.beans.factory.annotation.Value("${elasticsearch.host:localhost}") String host,
            @org.springframework.beans.factory.annotation.Value("${elasticsearch.port:9200}") int port) {
        this.host = host;
        this.port = port;
    }

    @Override
    public ClientConfiguration clientConfiguration() {
        return ClientConfiguration.builder()
                .connectedTo(host + ":" + port)
                .build();
    }
}
