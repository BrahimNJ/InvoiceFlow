import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the real stack: the production build (npm run build:e2e) served on :4200 and the
 * Spring Boot API on :8080 with PostgreSQL. The API is not started here; e2e/global-setup.ts checks it is up.
 * Runs in the installed Google Chrome (preinstalled on GitHub runners), so no browser download is needed.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Entrance animations and view transitions would make axe-core measure half-faded colours
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'phone', use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
  webServer: {
    command: 'node scripts/serve-dist.mjs 4200',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
  },
});
