package com.noteforge.note.service;

import com.noteforge.note.dto.NotebookResponse;
import com.noteforge.note.entity.NotebookEntity;
import com.noteforge.note.exception.ResourceNotFoundException;
import com.noteforge.note.repository.NotebookRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NotebookService {

    private final NotebookRepository notebookRepository;

    @CacheEvict(value = "notebooks:list", key = "#userId")
    public NotebookResponse createNotebook(String userId, String name, String icon, String color) {
        NotebookEntity entity = new NotebookEntity();
        entity.setUserId(userId);
        entity.setName(name);
        if (icon != null) entity.setIcon(icon);
        if (color != null) entity.setColor(color);
        notebookRepository.save(entity);
        return NotebookResponse.fromEntity(entity);
    }

    @Cacheable(value = "notebooks:list", key = "#userId", unless = "#result.isEmpty()")
    public List<NotebookResponse> listNotebooks(String userId) {
        return notebookRepository.findByUserIdOrderBySortOrderAsc(userId)
                .stream()
                .map(NotebookResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @CacheEvict(value = "notebooks:list", key = "#userId")
    public NotebookResponse renameNotebook(String notebookId, String userId, String name) {
        NotebookEntity entity = findNotebook(notebookId, userId);
        entity.setName(name);
        notebookRepository.save(entity);
        return NotebookResponse.fromEntity(entity);
    }

    @CacheEvict(value = "notebooks:list", key = "#userId")
    public void deleteNotebook(String notebookId, String userId) {
        NotebookEntity entity = findNotebook(notebookId, userId);
        notebookRepository.delete(entity);
    }

    private NotebookEntity findNotebook(String notebookId, String userId) {
        NotebookEntity entity = notebookRepository.findById(notebookId)
                .orElseThrow(() -> new ResourceNotFoundException("Notebook not found"));
        if (!entity.getUserId().equals(userId)) {
            throw new ResourceNotFoundException("Notebook not found");
        }
        return entity;
    }
}
