// npm run validate, build, export and export:preview in this folder: the commands of src/cli/cli.ts, run from the source, as `npx roadmapper` runs them from the package.
// With no file, a command reads data/roadmap.json, and `build` and `export` write into this folder's dist/. `export:preview` is the command `preview`.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const [name, ...words] = process.argv.slice(2);
const command = name === 'export:preview' ? 'preview' : name;
// the paths typed after `npm run <name> --` are from where they were typed, not from this folder, where npm runs the script
const here = (process.env.npm_lifecycle_event === name && process.env.INIT_CWD) || process.cwd();
const { module: cli } = await runnerImport(join(ROOT, 'src/cli/cli.ts'), { root: ROOT, configFile: false, logLevel: 'error' });
// npm keeps an option typed with no `--` before it, as in `npm run export --private`, and says so in its env
for (const option of cli.COMMANDS[command]?.options ?? []) {
  if (process.env[`npm_config_${option.slice(2)}`] === 'true' && !words.includes(option)) words.push(option);
}
const code = await cli.run(command, words, {
  here,
  name,
  file: join(ROOT, 'data/roadmap.json'),
  app: join(ROOT, 'dist/app'),
  export: join(ROOT, 'dist/export'),
  exportPrivate: join(ROOT, 'dist/export-private'),
  page: join(ROOT, 'dist/cli/app.html'),
  lib: join(ROOT, 'dist/lib/roadmapper-page.js'),
});
if (code !== undefined) process.exitCode = code;
