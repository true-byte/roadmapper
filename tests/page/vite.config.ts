import { defineConfig } from 'vite';
import { fewIcons, plainScript } from '../build.ts';

// The test page: an HTML file with its script in a file next to it, opened from disk. The tests open it about a hundred times, so it is kept light:
// its script is a plain script out of the page, and its icon set holds only the icons the test plans name (tests/build.ts).
export default defineConfig({
  base: './',
  plugins: [fewIcons, plainScript],
  build: {
    outDir: '../../dist/tests/page',
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: { output: { format: 'iife', entryFileNames: 'page.js', banner: "'use strict';" } },
  },
});
