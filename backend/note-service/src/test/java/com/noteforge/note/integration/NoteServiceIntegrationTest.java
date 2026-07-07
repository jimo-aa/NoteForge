package com.noteforge.note.integration;

import com.noteforge.common.AbstractIntegrationTest;
import com.noteforge.note.NoteServiceApplication;
import com.noteforge.note.config.TestSecurityConfig;
import com.noteforge.note.dto.NoteCreateRequest;
import com.noteforge.note.dto.NoteUpdateRequest;
import com.noteforge.note.entity.NoteEntity;
import com.noteforge.note.repository.NoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for NoteService using real PostgreSQL + Redis via Testcontainers.
 * Extends AbstractIntegrationTest which provides the containers.
 */
@SpringBootTest(
    classes = NoteServiceApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT
)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class NoteServiceIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private NoteRepository noteRepository;

    private static final String USER_ID = "integration-test-user";
    private static final String AUTH_HEADER = "Bearer test-token";

    @BeforeEach
    void setUp() {
        noteRepository.deleteAll();
    }

    private HttpEntity<?> withAuth() {
        return withAuth(null);
    }

    private HttpEntity<?> withAuth(Object body) {
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.set("Authorization", AUTH_HEADER);
        headers.set("Content-Type", "application/json");
        return new HttpEntity<>(body, headers);
    }

    // ── CREATE ──

    @SuppressWarnings("unchecked")
    @Test
    void createNote_shouldReturnNoteWithIdAndVersion() {
        NoteCreateRequest request = new NoteCreateRequest();
        request.setTitle("Integration Test Note");
        request.setContent("Hello from Testcontainers!");
        request.setTags(List.of("test", "integration"));

        ResponseEntity<Map> response = rest.exchange(
            "/api/v1/notes", HttpMethod.POST, withAuth(request), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat((int) response.getBody().get("code")).isZero();

        Map<String, Object> data = (Map<String, Object>) response.getBody().get("data");
        assertThat(data).isNotNull();
        assertThat((String) data.get("id")).isNotBlank();
        assertThat((String) data.get("title")).isEqualTo("Integration Test Note");
        assertThat((int) data.get("version")).isEqualTo(1);
    }

    // ── READ ──

    @SuppressWarnings("unchecked")
    @Test
    void getNote_shouldReturnNoteById() {
        // First create a note via repository
        NoteEntity entity = new NoteEntity();
        entity.setUserId(USER_ID);
        entity.setTitle("Test for Get");
        entity.setContent("Content for get test");
        noteRepository.save(entity);
        String noteId = entity.getId();

        // Then GET it
        ResponseEntity<Map> response = rest.exchange(
            "/api/v1/notes/{id}", HttpMethod.GET, withAuth(), Map.class, noteId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> data = (Map<String, Object>) response.getBody().get("data");
        assertThat((String) data.get("id")).isEqualTo(noteId);
        assertThat((String) data.get("title")).isEqualTo("Test for Get");
        assertThat((String) data.get("content")).isEqualTo("Content for get test");
    }

    @SuppressWarnings("unchecked")
    @Test
    void getNote_shouldReturn404_whenNotFound() {
        ResponseEntity<Map> response = rest.exchange(
            "/api/v1/notes/nonexistent-id", HttpMethod.GET, withAuth(), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ── UPDATE ──

    @SuppressWarnings("unchecked")
    @Test
    void updateNote_shouldIncrementVersionAndModifyFields() {
        // Create
        NoteEntity entity = new NoteEntity();
        entity.setUserId(USER_ID);
        entity.setTitle("Original Title");
        entity.setContent("Original content");
        noteRepository.save(entity);
        String noteId = entity.getId();

        // Update
        NoteUpdateRequest update = new NoteUpdateRequest();
        update.setTitle("Updated Title");
        update.setContent("Updated content");
        update.setIsFavorite(true);

        ResponseEntity<Map> response = rest.exchange(
            "/api/v1/notes/{id}", HttpMethod.PUT, withAuth(update), Map.class, noteId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> data = (Map<String, Object>) response.getBody().get("data");
        assertThat((String) data.get("title")).isEqualTo("Updated Title");
        assertThat((String) data.get("content")).isEqualTo("Updated content");
        assertThat((boolean) data.get("favorite")).isTrue();
        // Version incremented
        assertThat((int) data.get("version")).isEqualTo(2);
    }

    // ── DELETE (soft delete) ──

    @SuppressWarnings("unchecked")
    @Test
    void deleteNote_shouldSoftDeleteAndReturn404OnGet() {
        // Create
        NoteEntity entity = new NoteEntity();
        entity.setUserId(USER_ID);
        entity.setTitle("To Delete");
        entity.setContent("Content to delete");
        noteRepository.save(entity);
        String noteId = entity.getId();

        // Delete
        ResponseEntity<Map> deleteResponse = rest.exchange(
            "/api/v1/notes/{id}", HttpMethod.DELETE, withAuth(), Map.class, noteId);
        assertThat(deleteResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

        // Get should 404
        ResponseEntity<Map> getResponse = rest.exchange(
            "/api/v1/notes/{id}", HttpMethod.GET, withAuth(), Map.class, noteId);
        assertThat(getResponse.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ── LIST with pagination ──

    @SuppressWarnings("unchecked")
    @Test
    void listNotes_shouldReturnPaginatedResults() {
        // Create 5 notes
        for (int i = 0; i < 5; i++) {
            NoteEntity e = new NoteEntity();
            e.setUserId(USER_ID);
            e.setTitle("List Note " + i);
            e.setContent("Content " + i);
            noteRepository.save(e);
        }

        // Get page 0 with size 3
        ResponseEntity<Map> response = rest.exchange(
            "/api/v1/notes?page=0&size=3", HttpMethod.GET, withAuth(), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getBody();
        assertThat(body).isNotNull();

        Map<String, Object> data = (Map<String, Object>) body.get("data");
        assertThat(data).isNotNull();
        List<Map<String, Object>> items = (List<Map<String, Object>>) data.get("items");
        assertThat(items).hasSize(3);
        assertThat((int) data.get("totalElements")).isEqualTo(5);
        assertThat((int) data.get("totalPages")).isEqualTo(2);
    }

    // ── SEARCH ──

    @SuppressWarnings("unchecked")
    @Test
    void searchNotes_shouldFindByTitle() {
        NoteEntity entity = new NoteEntity();
        entity.setUserId(USER_ID);
        entity.setTitle("DistinctiveSearchTitle");
        entity.setContent("Some content");
        entity.setContentPlain("Some content");
        noteRepository.save(entity);

        ResponseEntity<Map> response = rest.exchange(
            "/api/v1/notes/search?q=DistinctiveSearchTitle", HttpMethod.GET, withAuth(), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getBody();
        assertThat(body).isNotNull();
        assertThat((int) body.get("code")).isZero();
    }
}
