import { defineConfig, devices } from '@playwright/test';

import base from './playwright.config';

/**
 * README screenshots (npm run screenshots): replays the journey on the real stack, like the end-to-end tests,
 * and writes the images to docs/screenshots. Same prerequisites: npm run build:e2e and the API on :8080.
 */
export default defineConfig({
  ...base,
  testMatch: '**/*.screenshots.ts',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  projects: [
    {
      name: 'screenshots',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
