// The dev server of `npm run dev`, as vite.config.ts makes it, as plain code: its plugins of the roadmap file, of the folder src/ and of the fonts, called with no server.
/// <reference types="node" />
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { loadConfigFromFile, type Plugin } from 'vite';
import { fontFiles, fontsFolder } from '../src/themes/fonts';

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

test('npm run dev serves the fonts of the theme at /fonts/, next to the page, and passes on any other name', async () => {
  const loaded = await loadConfigFromFile({ command: 'serve', mode: 'development' }, join(ROOT, 'vite.config.ts'), ROOT, 'error');
  const plugin = (loaded!.config.plugins ?? []).flat().find((p): p is Plugin => !!p && 'name' in p && p.name === 'theme-fonts')!;
  type Use = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
  const uses: [string, Use][] = [];
  (plugin.configureServer as (s: unknown) => void)({ middlewares: { use: (path: string, fn: Use) => uses.push([path, fn]) } });
  expect(uses.map(([path]) => path)).toEqual(['/fonts']);
  // the server takes /fonts off the address before the plugin sees it
  const get = (url: string): { type?: string; body?: Buffer; passed: boolean } => {
    const got: { type?: string; body?: Buffer; passed: boolean } = { passed: false };
    const res = { setHeader: (_: string, type: string) => (got.type = type), end: (b: Buffer) => (got.body = b) } as unknown as ServerResponse;
    uses[0][1]({ url } as IncomingMessage, res, () => (got.passed = true));
    return got;
  };
  for (const file of fontFiles()) {
    expect(get(`/${file}`), file).toEqual({ type: file.endsWith('.woff2') ? 'font/woff2' : 'text/plain; charset=utf-8', body: readFileSync(join(fontsFolder(), file)), passed: false });
  }
  for (const url of ['/', '/nope.woff2', '/../fonts.css', '/%2e%2e%2ftheme.css']) expect(get(url), url).toEqual({ passed: true });
});
