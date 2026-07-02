package com.noteforge.note.repository;

import com.noteforge.note.document.NoteDocument;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
@ConditionalOnProperty(name = "elasticsearch.enabled", havingValue = "true")
public interface NoteSearchRepository extends ElasticsearchRepository<NoteDocument, String> {

    List<NoteDocument> findByUserIdAndIsDeletedFalse(String userId);

    void deleteByUserIdAndId(String userId, String id);
}
