import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1360, height: 860 },
    trace: 'retain-on-failure',
    // Tracing records a frame for every animated paint, which slows runs badly and makes them flaky.
    // The sidebar tests in demo.spec.ts turn motion back on to cover the animated paths.
    contextOptions: { reducedMotion: 'reduce' },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
