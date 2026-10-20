import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The app page, src/app/index.html.
// `npm run dev` serves it on one roadmap file: the one in ROADMAP_FILE, which `npm run dev -- [file]` names (scripts/dev.mjs), or else data/roadmap.json.
// `vite build` makes it with no roadmap in it: dist/cli/app.html, one HTML file with the script and the styles inside it, which opens from disk too.
// `roadmapper build` and `roadmapper dev` put a roadmap in its slot (src/cli/cli.ts), and the page reads it from there (src/app/slot.ts).
const file = process.env.ROADMAP_FILE ?? fileURLToPath(new URL('data/roadmap.json', import.meta.url));

/** The text of the roadmap file, and its name, as the module 'virtual:roadmap'. Text, not a module of its own: a typo in the file then lands in the view's error list,
 * not in the dev server's error screen. The dev server watches the file, also outside this folder, and sends the new text when it is saved. */
function roadmapFile(file: string): Plugin {
  const id = '\0virtual:roadmap';
  return {
    name: 'roadmap-file',
    resolveId: source => (source === 'virtual:roadmap' ? id : undefined),
    load(source) {
      if (source !== id) return;
      this.addWatchFile(file);
      return `export default ${JSON.stringify(readFileSync(file, 'utf8'))};\nexport const file = ${JSON.stringify(basename(file))};\nexport const live = undefined;`;
    },
  };
}

/** The built page is app.html, as it holds no roadmap yet: the page of a build is the index.html that `roadmapper build` writes. */
const appPage: Plugin = {
  name: 'app-page',
  enforce: 'post',
  generateBundle(_, bundle) {
    const page = bundle['index.html'];
    if (page?.type !== 'asset') return;
    delete bundle['index.html'];
    this.emitFile({ type: 'asset', fileName: 'app.html', source: page.source });
  },
};

export default defineConfig(({ command }) => ({
  root: 'src/app',
  plugins: command === 'build' ? [viteSingleFile(), appPage] : [roadmapFile(file)],
  resolve: command === 'build' ? { alias: { 'virtual:roadmap': fileURLToPath(new URL('src/app/slot.ts', import.meta.url)) } } : {},
  // the CLI's build (vite.cli.config.ts) empties dist/cli first, and this writes the page next to it
  build: { outDir: '../../dist/cli', emptyOutDir: false },
}));
