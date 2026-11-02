import { chmodSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';

// The commands of the package, `npx roadmapper`, for Node: src/cli/bin.ts built into dist/cli/roadmapper.js, with all that it needs inside it,
// so the package has no dependency. It empties dist/cli first; the build of the app page (vite.config.ts) then writes dist/cli/app.html next to it.
export default defineConfig({
  publicDir: false,
  // each build writes the file anew, and a link to it, such as the one `npx roadmapper` makes in a clone, runs it only with this permission
  plugins: [{ name: 'run-permission', writeBundle: ({ dir = 'dist/cli' }) => chmodSync(join(dir, 'roadmapper.js'), 0o755) }],
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
