package com.noteforge.note.service;

import io.minio.*;
import io.minio.errors.MinioException;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.UUID;

@Service
public class AttachmentService {

    private static final Logger log = LoggerFactory.getLogger(AttachmentService.class);

    @Value("${minio.endpoint:}")
    private String endpoint;

    @Value("${minio.access-key:}")
    private String accessKey;

    @Value("${minio.secret-key:}")
    private String secretKey;

    @Value("${minio.bucket:noteforge-attachments}")
    private String bucket;

    private MinioClient minioClient;
    private boolean enabled = false;

    @PostConstruct
    public void init() {
        if (endpoint != null && !endpoint.isEmpty()
                && accessKey != null && !accessKey.isEmpty()
                && secretKey != null && !secretKey.isEmpty()) {
            try {
                minioClient = MinioClient.builder()
                        .endpoint(endpoint)
                        .credentials(accessKey, secretKey)
                        .build();

                boolean found = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
                if (!found) {
                    minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
                    log.info("Created MinIO bucket: {}", bucket);
                }
                enabled = true;
                log.info("MinIO client initialized: endpoint={}, bucket={}", endpoint, bucket);
            } catch (Exception e) {
                log.warn("Failed to initialize MinIO client: {}", e.getMessage());
            }
        } else {
            log.info("MinIO not configured; attachment upload is disabled");
        }
    }

    public String uploadAttachment(MultipartFile file, String userId) {
        if (!enabled) {
            throw new UnsupportedOperationException(
                    "Attachment upload is not configured. Set minio.endpoint/access-key/secret-key in application.yml");
        }
        try {
            String objectName = userId + "/" + UUID.randomUUID() + "_" + file.getOriginalFilename();
            try (InputStream is = file.getInputStream()) {
                minioClient.putObject(PutObjectArgs.builder()
                        .bucket(bucket)
                        .object(objectName)
                        .stream(is, file.getSize(), -1)
                        .contentType(file.getContentType())
                        .build());
            }
            String url = endpoint + "/" + bucket + "/" + objectName;
            log.info("Uploaded attachment: {}", url);
            return url;
        } catch (Exception e) {
            throw new RuntimeException("Failed to upload attachment: " + e.getMessage(), e);
        }
    }

    public void deleteAttachment(String objectUrl) {
        if (!enabled) return;
        try {
            String objectName = extractObjectName(objectUrl);
            if (objectName != null) {
                minioClient.removeObject(RemoveObjectArgs.builder()
                        .bucket(bucket)
                        .object(objectName)
                        .build());
                log.info("Deleted attachment: {}", objectName);
            }
        } catch (Exception e) {
            log.warn("Failed to delete attachment: {}", e.getMessage());
        }
    }

    private String extractObjectName(String url) {
        String prefix = endpoint + "/" + bucket + "/";
        if (url.startsWith(prefix)) {
            return url.substring(prefix.length());
        }
        return null;
    }
}
