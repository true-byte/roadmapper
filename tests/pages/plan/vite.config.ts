import { defineConfig } from 'vite';
import { fewIcons, plainScript } from '../../support/build.ts';

// The plan page: an HTML file with its script in a file next to it, opened from disk. The tests open it many times, so it is kept light:
// its script is a plain script out of the page, and its icon set holds only the icons the test plans name (tests/support/build.ts).
export default defineConfig({
  base: './',
  plugins: [fewIcons, plainScript],
  build: {
    outDir: '../../../dist/tests/plan',
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: { output: { format: 'iife', entryFileNames: 'page.js', banner: "'use strict';" } },
  },
});
