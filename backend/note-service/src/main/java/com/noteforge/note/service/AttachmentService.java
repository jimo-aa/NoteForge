package com.noteforge.note.service;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@Service
public class AttachmentService {

    @Value("${minio.endpoint:}")
    private String minioEndpoint;

    @Value("${minio.access-key:}")
    private String minioAccessKey;

    @Value("${minio.secret-key:}")
    private String minioSecretKey;

    @Value("${minio.bucket:noteforge-attachments}")
    private String bucket;

    private boolean enabled = false;

    @PostConstruct
    public void init() {
        if (!minioEndpoint.isEmpty() && !minioAccessKey.isEmpty() && !minioSecretKey.isEmpty()) {
            // TODO: initialize MinIO client when middleware is available
            enabled = true;
        }
    }

    public String uploadAttachment(MultipartFile file, String userId) {
        if (!enabled) {
            throw new UnsupportedOperationException("Attachment upload is not configured");
        }
        String objectName = userId + "/" + UUID.randomUUID() + "_" + file.getOriginalFilename();
        // TODO: implement MinIO putObject
        return minioEndpoint + "/" + bucket + "/" + objectName;
    }

    public void deleteAttachment(String objectUrl) {
        if (!enabled) return;
        // TODO: implement MinIO removeObject
    }
}
