import { defineConfig } from 'vite';
import { themeFonts } from '../../../src/themes/fonts.ts';
import { fewIcons, plainScript } from '../../support/build.ts';

// The embed page, built as the plan page is: a plain script out of the page, and only the icons the test plans name (tests/support/build.ts).
// The box loads its icon set as a part apart, which a plain script puts into itself. The loader of such a part asks import.meta, which a plain script
// has not: with no part apart, it never needs it, so that warning is off.
export default defineConfig({
  base: './',
  // no fonts of the theme: the page draws in the fallback fonts, which tests/support/layout.ts measures, and never draws its names again when a font loads
  plugins: [fewIcons, plainScript, themeFonts('none')],
  build: {
    outDir: '../../../dist/tests/embed',
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: { checks: { emptyImportMeta: false }, output: { format: 'iife', entryFileNames: 'app.js', banner: "'use strict';" } },
  },
});
