// The docs in docs/: a nerDDocs site, which `npx nerddocs check docs` checks as the reader's site would draw it.
/// <reference types="node" />
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ROOT } from './support/cli';

/** The command of the package nerddocs, as `npx nerddocs` runs it. */
function nerddocs(): string {
  const require = createRequire(join(ROOT, 'package.json'));
  const file = require.resolve('nerddocs/package.json');
  const { bin } = require(file) as { bin: Record<string, string> };
  return join(dirname(file), bin.nerddocs);
}

test('npx nerddocs check docs finds no problem', async () => {
  const said = await new Promise<{ code: number; out: string }>(done => {
    execFile(process.execPath, [nerddocs(), 'check', 'docs'], { cwd: ROOT }, (e, out, err) =>
      done({ code: e ? ((e as { code?: number }).code ?? 1) : 0, out: out + err }),
    );
  });
  expect(said, said.out).toEqual({ code: 0, out: expect.stringContaining('Problems: 0') });
});
