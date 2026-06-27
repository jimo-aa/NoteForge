package com.noteforge.note.service;

import com.noteforge.note.dto.NotebookResponse;
import com.noteforge.note.entity.NotebookEntity;
import com.noteforge.note.repository.NotebookRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NotebookService {

    private final NotebookRepository notebookRepository;

    public NotebookResponse createNotebook(String userId, String name, String icon, String color) {
        NotebookEntity entity = new NotebookEntity();
        entity.setUserId(userId);
        entity.setName(name);
        if (icon != null) entity.setIcon(icon);
        if (color != null) entity.setColor(color);
        notebookRepository.save(entity);
        return NotebookResponse.fromEntity(entity);
    }

    public List<NotebookResponse> listNotebooks(String userId) {
        return notebookRepository.findByUserIdOrderBySortOrderAsc(userId)
                .stream()
                .map(NotebookResponse::fromEntity)
                .collect(Collectors.toList());
    }

    public NotebookResponse renameNotebook(String notebookId, String userId, String name) {
        NotebookEntity entity = findNotebook(notebookId, userId);
        entity.setName(name);
        notebookRepository.save(entity);
        return NotebookResponse.fromEntity(entity);
    }

    public void deleteNotebook(String notebookId, String userId) {
        NotebookEntity entity = findNotebook(notebookId, userId);
        notebookRepository.delete(entity);
    }

    private NotebookEntity findNotebook(String notebookId, String userId) {
        NotebookEntity entity = notebookRepository.findById(notebookId)
                .orElseThrow(() -> new IllegalArgumentException("Notebook not found"));
        if (!entity.getUserId().equals(userId)) {
            throw new IllegalArgumentException("Notebook not found");
        }
        return entity;
    }
}
