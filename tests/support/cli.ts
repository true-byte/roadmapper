// What the tests of the commands share: src/cli/cli.ts run in this process, from the source, with what it prints; folders of a test's own; and what a server would answer.
// Vite loads the source, as scripts/roadmapper.mjs does, since src/cli/export.ts needs it. No process starts, so a command takes milliseconds.
/// <reference types="node" />
import { mkdtempSync, rmSync } from 'node:fs';
import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'node:util';
import { runnerImport } from 'vite';

/** The root of this clone. */
export const ROOT = fileURLToPath(new URL('../..', import.meta.url));

type Cli = typeof import('../../src/cli/cli');
type Export = typeof import('../../src/cli/export');
const load = async <T>(file: string): Promise<T> => (await runnerImport(join(ROOT, file), { root: ROOT, configFile: false, logLevel: 'error' })).module as T;
let cli: Promise<Cli> | undefined;
let exporter: Promise<Export> | undefined;
/** src/cli/cli.ts, loaded once in each worker. */
export const cliSource = (): Promise<Cli> => (cli ??= load<Cli>('src/cli/cli.ts'));
/** src/cli/export.ts, loaded once in each worker. */
export const exportSource = (): Promise<Export> => (exporter ??= load<Export>('src/cli/export.ts'));

/** How a command ended, and what it printed. */
export interface Said {
  code: number | undefined;
  out: string;
  err: string;
}

/** Runs `npx roadmapper <words>` as typed in the folder `here`, with the files the package has: the app page and the export's lib that dist/ holds. */
export async function roadmapper(words: string[], here: string): Promise<Said> {
  const { run } = await cliSource();
  const [command, ...rest] = words;
  const said = { out: '', err: '' };
  const { log, error } = console, write = process.stdout.write;
  console.log = (...a: unknown[]) => void (said.out += `${format(...a)}\n`);
  console.error = (...a: unknown[]) => void (said.err += `${format(...a)}\n`);
  process.stdout.write = ((chunk: string | Uint8Array) => ((said.out += chunk.toString()), true)) as typeof process.stdout.write;
  try {
    const code = await run(command, rest, {
      here,
      name: command ?? 'roadmapper',
      file: join(here, 'roadmap.json'),
      app: join(here, 'dist/app'),
      export: join(here, 'dist/export'),
      exportPrivate: join(here, 'dist/export-private'),
      page: join(ROOT, 'dist/cli/app.html'),
      lib: join(ROOT, 'dist/lib/roadmapper-page.js'),
    });
    return { code, ...said };
  } finally {
    Object.assign(console, { log, error });
    process.stdout.write = write;
  }
}

/** The env of a shell: the variables npm sets for `npm test` would point another npm at this clone. */
export const shell = (): NodeJS.ProcessEnv => Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('npm_') && k !== 'INIT_CWD'));

const made: string[] = [];
/** A new empty folder in the system's temp folder. removeFolders() deletes it. */
export function folder(): string {
  const dir = mkdtempSync(join(tmpdir(), 'roadmapper-test-'));
  made.push(dir);
  return dir;
}
/** Deletes each folder that folder() made. */
export function removeFolders(): void {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
}

/** What a request listener answers at a path, with no server: its status, its type and what it wrote so far. */
export function ask(listener: RequestListener, url: string): { status: number; type: string; body: () => string } {
  const req = { url, on: () => req } as unknown as IncomingMessage;
  const got = { status: 0, type: '', text: '' };
  const res = {
    writeHead: (status: number, headers: Record<string, string>) => Object.assign(got, { status, type: headers['content-type'] }),
    write: (b: string | Buffer) => (got.text += b.toString()),
    end: (b?: string | Buffer) => (got.text += b?.toString() ?? ''),
  } as unknown as ServerResponse;
  listener(req, res);
  return { status: got.status, type: got.type, body: () => got.text };
}
