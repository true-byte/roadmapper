import { defineConfig, type BuildOptions } from 'vite';

// The lib, in dist/lib, in three builds that `--mode` picks. `npm run build:lib` runs all three, `module` first, as it empties dist/lib.
const BUILDS: Record<string, BuildOptions> = {
  // For a project with a bundler: dist/lib/index.js (the tag) and dist/lib/react.js (the React component), as modules.
  // The icon set is a part of its own, loaded only when a roadmap is shown. React is the app's own, never a copy in the lib.
  // dist/lib/react.js keeps 'use client' at its top, so a React app that renders on a server takes it as a part for the browser.
  module: {
    emptyOutDir: true,
    lib: { entry: { index: 'src/lib/index.ts', react: 'src/lib/react.ts' }, formats: ['es'] },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime', 'react-dom'],
      output: {
        // what both import, the tag and all it draws with, is dist/lib/element.js, after src/lib/element.ts; else it would take the name of another of its modules
        chunkFileNames: chunk => (chunk.moduleIds.some(id => id.endsWith('/src/lib/element.ts')) ? 'element.js' : '[name].js'),
        banner: chunk => (chunk.isEntry && chunk.name === 'react' ? "'use client';" : ''),
      },
    },
  },
  // The lib as one plain script, dist/lib/roadmapper.js, for a page with no bundler. It opens from disk as well, which a module does not.
  // It holds the whole icon set, so it is about 2 MB.
  script: {
    lib: { entry: 'src/lib/script.ts', formats: ['iife'], name: 'Roadmapper', fileName: () => 'roadmapper.js' },
  },
  // The lib of an HTML export as one plain script, dist/lib/roadmapper-page.js, with no icon set in it. `npm run export` puts it next to the page.
  export: {
    lib: { entry: 'src/lib/export-script.ts', formats: ['iife'], name: 'Roadmapper', fileName: () => 'roadmapper-page.js' },
  },
};

export default defineConfig(({ mode }) => {
  if (!Object.hasOwn(BUILDS, mode)) throw new Error(`vite.lib.config.ts: --mode is one of ${Object.keys(BUILDS).join(', ')}, not ${mode}`);
  return { publicDir: false, build: { outDir: 'dist/lib', emptyOutDir: false, ...BUILDS[mode] } };
});
