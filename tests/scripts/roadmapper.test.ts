// `npm run validate`, `export` and `export:preview` in this clone: scripts/roadmapper.mjs, which runs the commands of src/cli/cli.ts from the source.
// npm runs it in this folder and says in its env where the command was typed, and which options it kept. Each test starts the script, as npm does.
/// <reference types="node" />
import { execFile } from 'node:child_process';
import { copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { folder, removeFolders, ROOT, shell } from '../support/cli';

/** Runs `npm run <command> -- <words>` as typed in the folder `from`, with what npm adds to the env, and gives how it ended and what it printed. */
function npmRun(command: string, words: string[], from: string, npm: Record<string, string> = {}): Promise<{ code: number; out: string; err: string }> {
  const env = { ...shell(), npm_lifecycle_event: command, INIT_CWD: from, ...npm };
  return new Promise(done => {
    execFile(process.execPath, [join(ROOT, 'scripts/roadmapper.mjs'), command, ...words], { cwd: ROOT, env }, (e, out, err) =>
      done({ code: e ? ((e as { code?: number }).code ?? 1) : 0, out, err }),
    );
  });
}

test.afterEach(removeFolders);

test('npm run validate with no file checks data/roadmap.json', async () => {
  expect(await npmRun('validate', [], ROOT)).toEqual({ code: 0, out: 'data/roadmap.json: no errors\n', err: '' });
});

test('npm run export takes paths and --private from where it is typed', async () => {
  const here = folder();
  copyFileSync(join(ROOT, 'tests/fixtures/export.json'), join(here, 'plan.json'));
  // `npm run export --private`, with no `--`: npm keeps the option and says so in the env
  const kept = await npmRun('export', ['plan.json', 'out'], here, { npm_config_private: 'true' });
  expect(kept.code, kept.err).toBe(0);
  expect(readFileSync(join(here, 'out/roadmap.json'), 'utf8')).toContain('Secret price');
});

test('npm run export:preview names its errors by the npm script', async () => {
  expect(await npmRun('export:preview', ['--hots'], ROOT)).toEqual({ code: 1, out: '', err: 'export:preview  Unknown option  --hots\n' });
});
