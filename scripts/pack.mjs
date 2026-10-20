// npm run package, once the lib and the commands are built: packs Roadmapper into dist/roadmapper-<version>.tgz, the version in package.json.
// It first deletes each older dist/roadmapper-*.tgz, so dist/ only ever holds the one package as it is now. It skips prepack, which would build it all again.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
for (const f of existsSync(DIST) ? readdirSync(DIST) : []) if (/^roadmapper-.*\.tgz$/.test(f)) rmSync(join(DIST, f));
const { status } = spawnSync('npm', ['pack', '--ignore-scripts', '--pack-destination', DIST], { cwd: ROOT, stdio: 'inherit' });
process.exit(status ?? 1);
