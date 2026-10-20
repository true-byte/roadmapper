// npm run dev [roadmap file] [options of Vite]: the live view of a roadmap file, data/roadmap.json unless named, on Roadmapper's own source, so a change
// to src/ shows too. The file comes first: this names it to vite.config.ts in ROADMAP_FILE, and runs Vite with the rest, such as --host.
// `npx roadmapper dev` serves the built page instead (src/cli/cli.ts).
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
// the path typed after `npm run dev --` is from where it was typed, not from this folder, where npm runs the script
const here = (process.env.npm_lifecycle_event === 'dev' && process.env.INIT_CWD) || process.cwd();
const file = args.length && !args[0].startsWith('-') ? resolve(here, args.shift()) : undefined;
const env = file ? { ...process.env, ROADMAP_FILE: file } : process.env;
const { status } = spawnSync(process.execPath, [join(ROOT, 'node_modules/vite/bin/vite.js'), ...args], { cwd: ROOT, env, stdio: 'inherit' });
process.exit(status ?? 1);
