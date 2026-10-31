// 'Save' of 'Edit on page' on the dev server, as plain code: no page and no server, and a temp folder for the roadmap file.
/// <reference types="node" />
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { expect, test } from '@playwright/test';
import { fileText, savePlan, saveRequest } from '../../src/cli/save';
import type { FileError } from '../../src/roadmap/errors';
import type { Roadmap } from '../../src/roadmap/types';

const PLAN: Roadmap = { title: 'Bakery', branches: [{ name: 'Shop', items: [{ id: 'lease', name: 'Sign the lease' }, { id: 'open', name: 'Opening day', waitsFor: ['lease'] }] }] };
const BEFORE = '{ "title": "Before", "branches": [{ "items": [{ "id": "a", "name": "A" }] }] }\n';
/** The host of a dev server that `npx roadmapper dev --host` serves to the network. */
const HOST = '192.168.1.20:5173';

let dir = '';
let file = '';
test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'roadmapper-save-'));
  file = join(dir, 'roadmap.json');
  writeFileSync(file, BEFORE);
});
test.afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** What saveRequest() answers to a request: by default a POST of JSON, from a page of HOST. */
function ask(body: string, o: { method?: string; headers?: Record<string, string | undefined> } = {}): Promise<{ status: number; errors: FileError[] }> {
  return new Promise(done => {
    const headers = { host: HOST, origin: `http://${HOST}`, 'content-type': 'application/json', ...o.headers };
    const req = Object.assign(Readable.from([Buffer.from(body)]), { method: o.method ?? 'POST', headers }) as unknown as IncomingMessage;
    let status = 0;
    const res = {
      writeHead: (s: number) => (status = s),
      end: (b: string) => done({ status, errors: (JSON.parse(b) as { errors: FileError[] }).errors }),
    } as unknown as ServerResponse;
    saveRequest(file)(req, res);
  });
}

test('a plan the check takes is written as JSON, two spaces in', () => {
  expect(savePlan(file, JSON.stringify(PLAN))).toEqual([]);
  expect(readFileSync(file, 'utf8')).toBe(`${JSON.stringify(PLAN, null, 2)}\n`);
  expect(fileText(PLAN)).toBe(readFileSync(file, 'utf8'));
});

test('a refused plan writes nothing and gives the errors at their lines', () => {
  const plan = { title: 'Bakery', branches: [{ items: [{ id: 'a', name: 'A', waitsFor: ['nope'] }] }] };
  expect(savePlan(file, JSON.stringify(plan))).toEqual([{ line: 10, path: '#1 › A', key: 'waitsFor', error: 'Unknown id', value: '"nope"' }]);
  expect(savePlan(file, '{ "title": ')).toEqual([{ line: 1, path: '', key: '', error: 'Invalid JSON', value: '' }]);
  expect(readFileSync(file, 'utf8')).toBe(BEFORE);
});

test('a POST of JSON from a page of this host writes the file', async () => {
  expect(await ask(JSON.stringify(PLAN))).toEqual({ status: 200, errors: [] });
  expect(readFileSync(file, 'utf8')).toBe(fileText(PLAN));
  expect(await ask(JSON.stringify({ ...PLAN, title: 'Loopback' }), { headers: { host: '[::1]:5173', origin: undefined } })).toEqual({ status: 200, errors: [] });
  expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({ title: 'Loopback' });
});

test('a plan the check refuses gets 422 with its errors', async () => {
  expect(await ask(JSON.stringify({ title: 'Bakery', branches: [] }))).toEqual({
    status: 422, errors: [{ line: 3, path: '', key: 'branches', error: 'Invalid value', value: '[]' }],
  });
  expect(readFileSync(file, 'utf8')).toBe(BEFORE);
});

test('another site, a site name, another type or method writes nothing', async () => {
  const body = JSON.stringify(PLAN);
  expect((await ask(body, { headers: { origin: 'https://other.test' } })).status).toBe(403);
  expect((await ask(body, { headers: { host: 'other.test:5173', origin: 'http://other.test:5173' } })).status).toBe(403);
  expect((await ask(body, { headers: { 'content-type': 'text/plain' } })).status).toBe(403);
  expect((await ask(body, { method: 'PUT' })).status).toBe(405);
  expect(readFileSync(file, 'utf8')).toBe(BEFORE);
});
