import { defineConfig } from 'vite';

// The commands of the package, `npx roadmapper`, for Node: src/cli/bin.ts built into dist/cli/roadmapper.js, with all that it needs inside it,
// so the package has no dependency. It empties dist/cli first; the build of the app page (vite.config.ts) then writes dist/cli/app.html next to it.
export default defineConfig({
  publicDir: false,
  ssr: { noExternal: true },
  build: {
    ssr: 'src/cli/bin.ts',
    outDir: 'dist/cli',
    emptyOutDir: true,
    rollupOptions: {
      output: { entryFileNames: 'roadmapper.js', chunkFileNames: '[name].js', banner: chunk => (chunk.isEntry ? '#!/usr/bin/env node' : '') },
    },
  },
});
