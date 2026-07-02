/**
 * Sync E2E Test
 *
 * Tests the full sync flow against a running backend stack (docker-compose).
 * Prerequisites: `docker compose -f infra/docker-compose.yml up -d`
 *
 * Flow:
 *   1. Register a test user
 *   2. Create a note via backend API
 *   3. Pull notes via sync API
 *   4. Verify the created note appears in the pull response
 *   5. Push a sync change (update note title)
 *   6. Verify the note was updated
 *   7. Cleanup: delete test user data
 */

import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:8081';
const TEST_USER = `e2e-test-${Date.now()}`;
const TEST_PASS = 'TestPass123!';

// Share auth token across steps
let authToken: string;
let noteId: string;

test.describe('Sync E2E', () => {
  test('1. Register test user', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/auth/register`, {
      data: {
        username: TEST_USER,
        password: TEST_PASS,
        email: `${TEST_USER}@test.noteforge`,
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    // Registration may return token directly or require login
    if (body.data?.accessToken) {
      authToken = body.data.accessToken;
    }
  });

  test('2. Login test user', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { username: TEST_USER, password: TEST_PASS },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    authToken = body.data?.accessToken;
    expect(authToken).toBeTruthy();
  });

  test('3. Create a note via backend API', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/notes`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        title: 'E2E Sync Test Note',
        content: '# Hello from E2E\n\nThis note was created by the E2E sync test.',
        notebookId: '',
        tags: ['e2e', 'sync-test'],
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    noteId = body.data?.id;
    expect(noteId).toBeTruthy();
  });

  test('4. Pull sync changes — verify note appears', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/v1/sync/pull?lastVersion=0`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const notes = body.data?.notes ?? body.notes ?? [];
    const found = notes.find((n: { id: string }) => n.id === noteId);
    expect(found).toBeTruthy();
    expect(found.title).toBe('E2E Sync Test Note');
  });

  test('5. Push a sync change — update note title', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/sync/push`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        changes: [
          {
            noteId,
            clientVersion: 0,
            title: 'E2E Sync Test Note (Updated)',
          },
        ],
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data?.accepted).toBeGreaterThanOrEqual(1);
  });

  test('6. Verify updated note in pull', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/v1/sync/pull?lastVersion=0`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const notes = body.data?.notes ?? body.notes ?? [];
    const found = notes.find((n: { id: string }) => n.id === noteId);
    expect(found).toBeTruthy();
    expect(found.title).toBe('E2E Sync Test Note (Updated)');
  });

  test('7. Cleanup — delete test note', async ({ request }) => {
    const res = await request.delete(`${API_BASE}/api/v1/notes/${noteId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    // 204 or 200 both acceptable
    expect(res.ok() || res.status() === 204).toBeTruthy();
  });
});
