// `npx roadmapper <command> [file] [folder] [options]`: the commands of src/cli/cli.ts, from the package, in the folder they are typed in.
// With no file, a command reads roadmap.json in that folder; `build` and `export` write into its dist/, and `preview` serves from there.
// vite.cli.config.ts builds this into dist/cli/roadmapper.js, next to the app page with no roadmap in it, dist/cli/app.html.
/// <reference types="node" />
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './cli.js';

const here = process.cwd();
const [command, ...words] = process.argv.slice(2);
const code = await run(command, words, {
  here,
  name: command ?? 'roadmapper',
  file: join(here, 'roadmap.json'),
  app: join(here, 'dist/app'),
  export: join(here, 'dist/export'),
  exportPrivate: join(here, 'dist/export-private'),
  page: fileURLToPath(new URL('app.html', import.meta.url)),
  lib: fileURLToPath(new URL('../lib/roadmapper-page.js', import.meta.url)),
});
if (code !== undefined) process.exitCode = code;
