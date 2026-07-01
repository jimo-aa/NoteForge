package com.noteforge.note.service;

import com.noteforge.note.dto.VersionResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@ActiveProfiles("test")
class VersionServiceTest {

    @Autowired
    private VersionService versionService;

    @Test
    void createVersion_shouldReturnVersionWithIncrementedNumber() {
        VersionResponse v1 = versionService.createVersion("note-1", "user-1", "v1", "content1", "plain1");
        assertThat(v1.getVersionNumber()).isEqualTo(1);
        assertThat(v1.getTitle()).isEqualTo("v1");
        assertThat(v1.getNoteId()).isEqualTo("note-1");

        VersionResponse v2 = versionService.createVersion("note-1", "user-1", "v2", "content2", "plain2");
        assertThat(v2.getVersionNumber()).isEqualTo(2);
    }

    @Test
    void listVersions_shouldReturnAllVersionsDescending() {
        versionService.createVersion("note-list", "user-list", "a", "a", "a");
        versionService.createVersion("note-list", "user-list", "b", "b", "b");
        versionService.createVersion("note-list", "user-list", "c", "c", "c");

        List<VersionResponse> versions = versionService.listVersions("note-list", "user-list");
        assertThat(versions).hasSize(3);
        assertThat(versions.get(0).getVersionNumber()).isEqualTo(3);
        assertThat(versions.get(2).getVersionNumber()).isEqualTo(1);
    }

    @Test
    void listVersions_shouldReturnEmpty_whenNoneExist() {
        List<VersionResponse> versions = versionService.listVersions("nonexistent", "user-1");
        assertThat(versions).isEmpty();
    }

    @Test
    void getVersion_shouldReturnCorrectVersion() {
        versionService.createVersion("note-get", "user-get", "first", "first", "first");
        versionService.createVersion("note-get", "user-get", "second", "second", "second");

        VersionResponse v1 = versionService.getVersion("note-get", "user-get", 1);
        assertThat(v1.getVersionNumber()).isEqualTo(1);
        assertThat(v1.getTitle()).isEqualTo("first");

        VersionResponse v2 = versionService.getVersion("note-get", "user-get", 2);
        assertThat(v2.getVersionNumber()).isEqualTo(2);
        assertThat(v2.getTitle()).isEqualTo("second");
    }

    @Test
    void getVersion_shouldThrow_whenNotFound() {
        assertThrows(Exception.class,
                () -> versionService.getVersion("no-such-note", "user-1", 999));
    }
}
