import { defineConfig } from '@playwright/test';

// Browser tests on the built pages, opened from disk: no server, no build of its own. `npm test` builds the pages, then runs this.
// Offline, so the app page draws in the fallback fonts, as the test page does.
// Every test runs on its own, one on each core. With reduced motion, so a move ends in one frame: a test that checks a move turns motion on,
// and plays the move on Playwright's clock, as a test of a look that lasts does.
export default defineConfig({
  testDir: 'tests',
  outputDir: 'dist/test-results',
  reporter: 'list',
  forbidOnly: true,
  fullyParallel: true,
  workers: '100%',
  use: {
    browserName: 'chromium',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    viewport: { width: 1440, height: 900 },
    offline: true,
  },
});
