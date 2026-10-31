// The commands of Roadmapper: `npx roadmapper <command>` from the package (src/cli/bin.ts), and `npm run <command>` in this folder (scripts/roadmapper.mjs).
// Each command gets the folder it was typed in and the files it uses, and does not know which of the two runs it: each path typed is from that folder,
// and each path printed is to it. A command that cannot do its work writes nothing, prints one line for each error, and ends with exit code 1.
/// <reference types="node" />
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, watch, writeFileSync } from 'node:fs';
import { createServer, type RequestListener, type ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { checkRoadmap } from '../roadmap/check.js';
import { RoadmapError, sayError, sayFailure, type ErrorName, type FileError } from '../roadmap/errors.js';
import { exportFiles, FILES } from './export.js';
import { fileKey } from './key.js';
import { SAVE, saveRequest } from './save.js';

/** What a command uses, as the one who runs it gives it. */
export interface Setup {
  /** The folder the command was typed in. */
  here: string;
  /** The name of the command as typed, for its errors: `export:preview` is the command `preview` in this folder. */
  name: string;
  /** The roadmap file, when none is typed. */
  file: string;
  /** The folders that `build`, `export` and `export --private` write into, and `preview` serves, when none is typed. */
  app: string;
  export: string;
  exportPrivate: string;
  /** The app page with no roadmap in it, dist/cli/app.html, which `build` and `dev` put the roadmap in. */
  page: string;
  /** The export's lib, dist/lib/roadmapper-page.js, which `export` writes next to the page. */
  lib: string;
}

/** Each command: how many paths it takes, and the options it takes. */
export const COMMANDS = {
  dev: { paths: 1, options: ['--host'] },
  build: { paths: 2, options: [] },
  validate: { paths: 1, options: [] },
  export: { paths: 2, options: ['--private'] },
  preview: { paths: 0, options: ['--private', '--host'] },
} satisfies Record<string, { paths: number; options: string[] }>;
type Command = keyof typeof COMMANDS;

const USAGE = `npx roadmapper dev [file] [--host]
npx roadmapper build [file] [folder]
npx roadmapper validate [file]
npx roadmapper export [--private] [file] [folder]
npx roadmapper preview [--private] [--host]
`;

/** Runs a command with the words typed after it, options anywhere among the paths. It gives the exit code, or nothing for `dev` and `preview`,
 * which serve until they are stopped. With no command, it prints how each command is typed. */
export async function run(command: string | undefined, words: string[], s: Setup): Promise<number | undefined> {
  if (command === undefined || command === '--help' || command === '-h') {
    process.stdout.write(USAGE);
    return 0;
  }
  if (!Object.hasOwn(COMMANDS, command)) return fail('roadmapper', 'Unknown option', command);
  const spec: { paths: number; options: string[] } = COMMANDS[command as Command];
  const odd = words.find(w => w.startsWith('-') && !spec.options.includes(w));
  if (odd) return fail(s.name, 'Unknown option', odd);
  const typed = words.filter(w => !w.startsWith('-'));
  if (typed.length > spec.paths) return fail(s.name, 'Unknown option', typed[spec.paths]);
  const paths = typed.map(p => resolve(s.here, p));
  const has = (option: string): boolean => words.includes(option);
  const to = (path: string): string => relative(s.here, path) || '.';

  switch (command as Command) {
    case 'validate': {
      const [file = s.file] = paths;
      const text = checked(file, to, line => console.log(line));
      if (text === undefined) return 1;
      console.log(`${to(file)}: no errors`);
      return 0;
    }

    case 'build': {
      const [file = s.file, folder = s.app] = paths;
      // what a build writes into its folder: the one file of the page
      const no = refusal(folder, ['index.html']);
      if (no) return fail(to(folder), no.error, no.value);
      const text = checked(file, to, line => console.error(line));
      if (text === undefined) return 1;
      const page = read(s.page);
      if (page === undefined) return fail(to(s.page), 'Unreadable file');
      const html = fillPage(page, { text, file: basename(file), key: fileKey(file) });
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, 'index.html'), html);
      console.log(`${to(folder)}/index.html  ${kb(html)}`);
      return 0;
    }

    case 'export': {
      const keep = { private: has('--private') };
      const [file = s.file, folder = keep.private ? s.exportPrivate : s.export] = paths;
      if (!existsSync(s.lib)) return fail(to(s.lib), 'Unreadable file');
      const lib = readFileSync(s.lib);
      const wrong = refusal(folder, Object.values(FILES));
      if (wrong) return fail(to(folder), wrong.error, wrong.value);
      // the export must never take the place of the owner's file, by any path or link to it, also in a folder that holds an export
      const out = join(folder, FILES.roadmap);
      if (existsSync(out) && existsSync(file) && same(out, file)) return fail(to(folder), 'Folder not empty', FILES.roadmap);
      const text = checked(file, to, line => console.error(line));
      if (text === undefined) return 1;
      let files: { page: string; roadmap: string };
      try {
        files = await exportFiles(text, keep);
      } catch (e) {
        // the file is checked above, so what is left is a roadmap where every item is private: 'Nothing public'
        if (!(e instanceof RoadmapError)) throw e;
        return fail(to(file), e.error);
      }
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, FILES.lib), lib);
      writeFileSync(out, files.roadmap);
      writeFileSync(join(folder, FILES.page), files.page);
      const said: [string, string | Buffer][] = [[FILES.page, files.page], [FILES.roadmap, files.roadmap], [FILES.lib, lib]];
      console.log(said.map(([f, t]) => `${to(folder)}/${f}  ${kb(t)}`).join('\n'));
      return 0;
    }

    case 'dev': {
      const [file = s.file] = paths;
      const first = read(file);
      if (first === undefined) {
        console.error(`${to(file)}:${sayError(UNREADABLE)}`);
        return 1;
      }
      const page = read(s.page);
      if (page === undefined) return fail(to(s.page), 'Unreadable file');
      // a file with errors still serves: the page shows its error list, as it does for each broken save
      let text = first;
      const name = basename(file), key = fileKey(file);
      const live = devServer(page, () => ({ text, file: name, key }), file);
      // a save that replaces the file, as many editors do, is seen in its folder, not on the file
      let wait: ReturnType<typeof setTimeout> | undefined;
      watch(dirname(file), (_, changed) => {
        if (changed && String(changed) !== name) return;
        clearTimeout(wait);
        wait = setTimeout(() => {
          const next = read(file);
          if (next === undefined || next === text) return;
          text = next;
          live.send({ text, file: name });
        }, 40);
      });
      await serve(live.listener, has('--host'), 5173, '/');
      return undefined;
    }

    case 'preview': {
      const folder = has('--private') ? s.exportPrivate : s.export;
      if (!existsSync(join(folder, FILES.page))) return fail(to(join(folder, FILES.page)), 'Unreadable file');
      await serve(previewServer(folder), has('--host'), 4173, `/${FILES.page}`);
      return undefined;
    }
  }
}

/** Prints one error of a command, in the shape of the errors of the file check, and gives the exit code. */
function fail(where: string, error: ErrorName, value = ''): number {
  console.error(sayFailure(where, error, value));
  return 1;
}

const UNREADABLE: FileError = { line: 0, path: '', key: '', error: 'Unreadable file', value: '' };

/** The text of a file, or nothing when it cannot be read. */
function read(file: string): string | undefined {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
}

/** The text of a roadmap file with no error. Otherwise it says each error of the file, as `validate` prints it, and gives nothing. */
function checked(file: string, to: (path: string) => string, say: (line: string) => void): string | undefined {
  const text = read(file);
  const errors = text === undefined ? [UNREADABLE] : checkRoadmap(text).errors;
  if (!errors.length) return text;
  for (const e of errors) say(`${to(file)}:${sayError(e)}`);
  return undefined;
}

const kb = (t: string | Buffer): string => `${Math.max(1, Math.round(Buffer.byteLength(t) / 1024))} kB`;

/** Are the two paths the same file, by any path or link? */
function same(a: string, b: string): boolean {
  const x = statSync(a, { bigint: true }), y = statSync(b, { bigint: true });
  return x.dev === y.dev && x.ino === y.ino;
}

/** The error of a folder that a command writing `files` must not write into, with its value, or nothing when it may.
 * The folder may be missing, empty, or hold exactly what the command wrote there before, which it writes over. Any other file in it is someone's own,
 * such as the roadmap file itself or a project's folder: 'Folder not empty', with the files that are not the command's, or with all its files
 * when it holds only a part of what the command writes. A path that is a file, or lies inside one: 'Not a folder'. */
function refusal(folder: string, files: string[]): { error: ErrorName; value: string } | undefined {
  let entries;
  try {
    if (!statSync(folder).isDirectory()) return { error: 'Not a folder', value: '' };
    entries = readdirSync(folder, { withFileTypes: true });
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return undefined;
    if (code === 'ENOTDIR') return { error: 'Not a folder', value: '' };
    throw e;
  }
  if (!entries.length) return undefined;
  // a folder or a link by the name of a file the command writes is someone's own too
  const own = entries.filter(e => !e.isFile() || !files.includes(e.name));
  if (!own.length && entries.length === files.length) return undefined;
  const names = (own.length ? own : entries).map(e => (e.isDirectory() ? `${e.name}/` : e.name)).sort();
  return { error: 'Folder not empty', value: names.join(', ') };
}

/** The slot of the app page that holds the roadmap: src/app/index.html has it empty, and src/app/slot.ts reads it. */
const SLOT = '<script type="application/json" id="roadmap"></script>';

/** The app page with a roadmap in its slot: the text of the file, the name of the file, the key of the file (key.ts), and for `dev` the address that sends each save
 * of the file and the address that 'Save' of 'Edit on page' sends the plan to. */
function fillPage(page: string, roadmap: { text: string; file: string; key?: string; live?: string; save?: string }): string {
  // the page's own script comes before the slot, in its head
  const at = page.lastIndexOf(SLOT);
  if (at < 0) throw new Error(`the app page has no ${SLOT}`);
  // with no "<" in the slot, no text of the roadmap can end the script
  const json = JSON.stringify(roadmap).replace(/</g, '\\u003c');
  return `${page.slice(0, at)}<script type="application/json" id="roadmap">${json}</script>${page.slice(at + SLOT.length)}`;
}

/** The address of the dev server that sends the roadmap file each time it is saved, as server-sent events. */
const EVENTS = '/events';

/** What `dev` serves: the app page at /, with the roadmap file as it is now, at /events each save of the file, as the page's src/app/main.ts reads it,
 * and at /save the plan that 'Save' of 'Edit on page' sends, which it writes into `file` (src/cli/save.ts). */
export function devServer(page: string, now: () => { text: string; file: string; key?: string }, file: string): { listener: RequestListener; send: (roadmap: { text: string; file: string }) => void } {
  const pages = new Set<ServerResponse>();
  const save = saveRequest(file);
  const listener: RequestListener = (req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    if (path === '/') return answer(res, 200, 'text/html; charset=utf-8', fillPage(page, { ...now(), live: EVENTS, save: SAVE }));
    if (path === SAVE) return save(req, res);
    if (path !== EVENTS) return answer(res, 404, 'text/plain; charset=utf-8', 'Not found');
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
    res.write(': open\n\n');
    pages.add(res);
    req.on('close', () => pages.delete(res));
  };
  // JSON has no line break in it, so the event is one line of data
  const send = (roadmap: { text: string; file: string }): void => {
    for (const res of pages) res.write(`data: ${JSON.stringify(roadmap)}\n\n`);
  };
  return { listener, send };
}

/** What `preview` serves: the three files of the export in `folder`, the page also without its .html, as a site does. */
export function previewServer(folder: string): RequestListener {
  const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
  return (req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    const name = path === '/roadmap' ? FILES.page : path.slice(1);
    let body: Buffer | undefined;
    try {
      if ((Object.values(FILES) as string[]).includes(name)) body = readFileSync(join(folder, name));
    } catch {
      body = undefined;
    }
    if (body === undefined) return answer(res, 404, 'text/plain; charset=utf-8', 'Not found');
    answer(res, 200, types[extname(name)], body);
  };
}

function answer(res: ServerResponse, status: number, type: string, body: string | Buffer): void {
  // the browser asks again each time, so a new build or export shows on the next load
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-cache' });
  res.end(body);
}

/** The name of this computer, to the browser on it. */
const LOCAL = 'localhost';

/** Serves on the first free port from `port` on: to this computer only, or with `host` to the network too. Then prints the address of `path`. */
async function serve(listener: RequestListener, host: boolean, port: number, path: string): Promise<void> {
  const server = createServer(listener);
  for (let p = port; ; p++) {
    try {
      await new Promise<void>((done, failed) => {
        server.once('error', failed);
        server.listen(p, host ? undefined : LOCAL, () => {
          server.off('error', failed);
          done();
        });
      });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EADDRINUSE' && p < port + 20) continue;
      throw e;
    }
    console.log(`  Local:   http://${LOCAL}:${p}${path}`);
    if (host) {
      for (const nets of Object.values(networkInterfaces())) {
        for (const net of nets ?? []) if (net.family === 'IPv4' && !net.internal) console.log(`  Network: http://${net.address}:${p}${path}`);
      }
    }
    return;
  }
}
