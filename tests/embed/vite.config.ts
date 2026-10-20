import { defineConfig } from 'vite';
import { fewIcons, plainScript } from '../build';

// The embed page, built as the test page is: a plain script out of the page, and only the icons the test plans name (tests/build.ts).
// The box loads its icon set as a part apart, which a plain script puts into itself. The loader of such a part asks import.meta, which a plain script
// has not: with no part apart, it never needs it, so that warning is off.
export default defineConfig({
  base: './',
  plugins: [fewIcons, plainScript],
  build: {
    outDir: '../../dist/tests/embed',
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: { checks: { emptyImportMeta: false }, output: { format: 'iife', entryFileNames: 'app.js', banner: "'use strict';" } },
  },
});
