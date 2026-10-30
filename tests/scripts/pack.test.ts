// `npm run package`, once the lib and the commands are built: scripts/pack.mjs packs Roadmapper into dist/roadmapper-<version>.tgz.
// The test runs a copy of the script in a made-up clone in the system's temp folder, which holds only a package.json, so the pack is small and dist/ of this clone stays.
/// <reference types="node" />
import { execFile } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { folder, removeFolders, ROOT, shell } from '../support/cli';

test.afterEach(removeFolders);

test('npm run package keeps only the package of this version in dist/', async () => {
  const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string };
  const clone = folder();
  mkdirSync(join(clone, 'scripts'));
  mkdirSync(join(clone, 'dist'));
  copyFileSync(join(ROOT, 'scripts/pack.mjs'), join(clone, 'scripts/pack.mjs'));
  writeFileSync(join(clone, 'package.json'), JSON.stringify({ name: 'roadmapper', version, private: true }));
  writeFileSync(join(clone, 'dist', 'roadmapper-0.0.1-old.tgz'), 'an old package');
  writeFileSync(join(clone, 'dist', `roadmapper-${version}.tgz`), 'a package before');
  writeFileSync(join(clone, 'dist', 'notes.txt'), 'mine');
  const packed = await new Promise<{ code: number; said: string }>(done => {
    execFile(process.execPath, [join(clone, 'scripts/pack.mjs')], { cwd: clone, env: shell() }, (e, out, err) =>
      done({ code: e ? ((e as { code?: number }).code ?? 1) : 0, said: out + err }),
    );
  });
  expect(packed.code, packed.said).toBe(0);
  expect(readdirSync(join(clone, 'dist')).sort()).toEqual(['notes.txt', `roadmapper-${version}.tgz`]);
  // a new package, which gzip starts with 1f 8b
  expect(readFileSync(join(clone, 'dist', `roadmapper-${version}.tgz`)).subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b]));
});
