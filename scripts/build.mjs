// npm run build:lib, build:cli and build:tests: the builds of the lib, the commands and the pages that the tests open, by their names, such as
// `node scripts/build.mjs lib cli tests`. Each step starts once the steps it needs have ended, so steps that need nothing of each other run side by side.
// A step that needs a step of a build not asked for takes what that build made last. Each step prints its output when it ends.
// At the first step that fails, the others stop and the build ends with exit code 1.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TSC = join(ROOT, 'node_modules/typescript/bin/tsc');
const VITE = join(ROOT, 'node_modules/vite/bin/vite.js');
const ROADMAPPER = join(ROOT, 'scripts/roadmapper.mjs');

/** Each build, as its steps: the command, and the steps that must end first, by build and step. */
const BUILDS = {
  lib: {
    types: { run: [TSC, '--noEmit'] },
    // it empties dist/lib, so it goes first
    module: { run: [VITE, 'build', '--config', 'vite.lib.config.ts', '--mode', 'module'] },
    script: { run: [VITE, 'build', '--config', 'vite.lib.config.ts', '--mode', 'script'], after: ['lib.module'] },
    export: { run: [VITE, 'build', '--config', 'vite.lib.config.ts', '--mode', 'export'], after: ['lib.module'] },
    declarations: { run: [TSC, '-p', 'tsconfig.lib.json'], after: ['lib.module'] },
  },
  cli: {
    // it empties dist/cli, so it goes first
    commands: { run: [VITE, 'build', '--config', 'vite.cli.config.ts'] },
    app: { run: [VITE, 'build'], after: ['cli.commands'] },
  },
  tests: {
    app: { run: [ROADMAPPER, 'build', 'tests/fixtures/roadmap.json', 'dist/tests/app'], after: ['cli.app'] },
    plan: { run: [VITE, 'build', 'tests/pages/plan', '--config', 'tests/pages/plan/vite.config.ts'] },
    embed: { run: [VITE, 'build', 'tests/pages/embed', '--config', 'tests/pages/embed/vite.config.ts'] },
    export: { run: [ROADMAPPER, 'export', 'tests/fixtures/export.json', 'dist/tests/export'], after: ['lib.export'] },
  },
};

const asked = process.argv.slice(2);
if (!asked.length || asked.some(name => !Object.hasOwn(BUILDS, name))) {
  console.error(`Usage: node scripts/build.mjs ${Object.keys(BUILDS).join(' | ')} ...`);
  process.exit(1);
}

/** The steps of the builds asked for, by build and step, such as 'lib.module'. */
const steps = new Map(asked.flatMap(name => Object.entries(BUILDS[name]).map(([step, s]) => [`${name}.${step}`, s])));
const running = new Map();
const ended = new Set();

function start() {
  for (const [key, { run, after = [] }] of steps) {
    if (running.has(key) || ended.has(key) || !after.every(k => ended.has(k) || !steps.has(k))) continue;
    const child = spawn(process.execPath, run, { cwd: ROOT, env: process.env });
    let out = '';
    child.stdout.on('data', d => (out += d));
    child.stderr.on('data', d => (out += d));
    running.set(key, child);
    child.on('close', code => {
      running.delete(key);
      process.stdout.write(`\n> ${key}\n${out}`);
      if (code !== 0) {
        for (const other of running.values()) other.kill();
        console.error(`\nThe step ${key} failed.`);
        process.exit(1);
      }
      ended.add(key);
      start();
    });
  }
}
start();
