// The dev server of `npm run dev`, as vite.config.ts makes it, as plain code: its plugin of the roadmap file, called with no server.
/// <reference types="node" />
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { loadConfigFromFile, type Plugin } from 'vite';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

test('npm run dev gives the page Save, which writes its own file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'roadmapper-vite-'));
  const file = join(dir, 'mine.json');
  writeFileSync(file, '{ "title": "Before", "branches": [{ "items": [{ "id": "a", "name": "A" }] }] }\n');
  const was = process.env.ROADMAP_FILE;
  process.env.ROADMAP_FILE = file;
  try {
    const loaded = await loadConfigFromFile({ command: 'serve', mode: 'development' }, join(ROOT, 'vite.config.ts'), ROOT, 'error');
    const plugin = (loaded!.config.plugins ?? []).flat().find((p): p is Plugin => !!p && 'name' in p && p.name === 'roadmap-file')!;
    const load = plugin.load as (id: string) => string;
    expect(load.call({ addWatchFile: () => {} }, '\0virtual:roadmap')).toContain('\nexport const save = "/save";');

    const uses: [string, (req: IncomingMessage, res: ServerResponse) => void][] = [];
    (plugin.configureServer as (s: unknown) => void)({ middlewares: { use: (path: string, fn: (typeof uses)[0][1]) => uses.push([path, fn]) } });
    expect(uses.map(([path]) => path)).toEqual(['/save']);
    const plan = { title: 'Saved', branches: [{ items: [{ id: 'a', name: 'A' }] }] };
    const headers = { host: '192.168.1.20:5173', 'content-type': 'application/json' };
    const req = Object.assign(Readable.from([Buffer.from(JSON.stringify(plan))]), { method: 'POST', headers }) as unknown as IncomingMessage;
    const status = await new Promise<number>(done => {
      let s = 0;
      uses[0][1](req, { writeHead: (code: number) => (s = code), end: () => done(s) } as unknown as ServerResponse);
    });
    expect(status).toBe(200);
    expect(readFileSync(file, 'utf8')).toBe(`${JSON.stringify(plan, null, 2)}\n`);
  } finally {
    if (was === undefined) delete process.env.ROADMAP_FILE;
    else process.env.ROADMAP_FILE = was;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('npm run dev watches the folder src/, so a file saved by a rename still shows', async () => {
  const loaded = await loadConfigFromFile({ command: 'serve', mode: 'development' }, join(ROOT, 'vite.config.ts'), ROOT, 'error');
  const plugin = (loaded!.config.plugins ?? []).flat().find((p): p is Plugin => !!p && 'name' in p && p.name === 'watch-source')!;
  const added: string[] = [];
  (plugin.configureServer as (s: unknown) => void)({ watcher: { add: (path: string) => added.push(path) } });
  expect(added).toEqual([join(ROOT, 'src')]);
});
