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
        return notebookRepository.findByUserIdAndIsDeletedFalseOrderBySortOrderAsc(userId)
                .stream()
                .map(NotebookResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Cacheable(value = "notebooks:detail", key = "#notebookId", unless = "#result == null")
    public NotebookResponse getNotebook(String notebookId, String userId) {
        NotebookEntity entity = findNotebook(notebookId, userId);
        return NotebookResponse.fromEntity(entity);
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
        entity.setDeleted(true);
        notebookRepository.save(entity);
    }

    @CacheEvict(value = "notebooks:list", key = "#userId")
    public void reorderNotebooks(String userId, List<String> orderedIds) {
        for (int i = 0; i < orderedIds.size(); i++) {
            NotebookEntity entity = notebookRepository.findById(orderedIds.get(i)).orElse(null);
            if (entity != null && entity.getUserId().equals(userId)) {
                entity.setSortOrder(i);
                notebookRepository.save(entity);
            }
        }
    }

    private NotebookEntity findNotebook(String notebookId, String userId) {
        NotebookEntity entity = notebookRepository.findById(notebookId)
                .orElseThrow(() -> new ResourceNotFoundException("Notebook not found"));
        if (!entity.getUserId().equals(userId) || entity.isDeleted()) {
            throw new ResourceNotFoundException("Notebook not found");
        }
        return entity;
    }
}
