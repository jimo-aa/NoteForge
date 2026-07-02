import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8081',
    extraHTTPHeaders: { 'Content-Type': 'application/json' },
  },
  projects: [
    {
      name: 'sync-e2e',
      testMatch: 'sync.spec.ts',
    },
  ],
});
