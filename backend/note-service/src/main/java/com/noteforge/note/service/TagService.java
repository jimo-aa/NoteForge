package com.noteforge.note.service;

import com.noteforge.note.dto.TagResponse;
import com.noteforge.note.entity.TagEntity;
import com.noteforge.note.exception.ResourceNotFoundException;
import com.noteforge.note.repository.TagRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TagService {

    private final TagRepository tagRepository;

    public TagResponse createTag(String userId, String name, String color) {
        TagEntity entity = new TagEntity();
        entity.setUserId(userId);
        entity.setName(name);
        if (color != null) entity.setColor(color);
        tagRepository.save(entity);
        return TagResponse.fromEntity(entity);
    }

    public List<TagResponse> listTags(String userId) {
        return tagRepository.findByUserId(userId)
                .stream()
                .map(TagResponse::fromEntity)
                .collect(Collectors.toList());
    }

    public void deleteTag(String tagId, String userId) {
        TagEntity entity = tagRepository.findById(tagId)
                .orElseThrow(() -> new ResourceNotFoundException("Tag not found"));
        if (!entity.getUserId().equals(userId)) {
            throw new ResourceNotFoundException("Tag not found");
        }
        tagRepository.delete(entity);
    }
}
