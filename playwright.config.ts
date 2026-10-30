import { defineConfig } from '@playwright/test';

// Two kinds of test, by the end of the file name. A .test.ts file opens no page: it runs the code in Node, in milliseconds.
// A .spec.ts file opens the built pages from disk: no server, no build of its own. `npm test` builds the pages, then runs both.
// The pages run offline, so the app page draws in the fallback fonts, as the plan page does. Every test runs on its own, one on each core.
// With reduced motion, so a move ends in one frame: a test that checks a move turns motion on, and plays the move on Playwright's clock.
export default defineConfig({
  testDir: 'tests',
  outputDir: 'dist/test-results',
  reporter: 'list',
  forbidOnly: true,
  fullyParallel: true,
  workers: '100%',
  projects: [
    { name: 'plain', testMatch: '**/*.test.ts', fullyParallel: false },
    {
      name: 'browser',
      testMatch: '**/*.spec.ts',
      use: {
        browserName: 'chromium',
        colorScheme: 'dark',
        reducedMotion: 'reduce',
        viewport: { width: 1440, height: 900 },
        offline: true,
      },
    },
  ],
});
