package com.noteforge.note.document;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import java.util.List;

@Data
@Document(indexName = "noteforge-notes")
public class NoteDocument {

    @Id
    private String id;

    @Field(type = FieldType.Keyword)
    private String userId;

    @Field(type = FieldType.Text, analyzer = "standard")
    private String title;

    @Field(type = FieldType.Text, analyzer = "standard")
    private String content;

    @Field(type = FieldType.Text, analyzer = "standard")
    private String contentPlain;

    @Field(type = FieldType.Keyword)
    private List<String> tags;

    @Field(type = FieldType.Keyword)
    private String notebookId;

    @Field(type = FieldType.Boolean)
    private boolean isPinned;

    @Field(type = FieldType.Boolean)
    private boolean isFavorite;

    @Field(type = FieldType.Boolean)
    private boolean isDeleted;

    @Field(type = FieldType.Integer)
    private int wordCount;

    @Field(type = FieldType.Integer)
    private int version;

    @Field(type = FieldType.Date)
    private String createdAt;

    @Field(type = FieldType.Date)
    private String updatedAt;
}
