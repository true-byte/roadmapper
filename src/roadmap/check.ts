// The file check: every error of the text of a roadmap file, each with its line, or of a roadmap given as data.
import { cut, sayError, type ErrorName, type FileError } from './errors.js';
import { STATES, type Roadmap } from './types.js';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Is this a real day, written as YYYY-MM-DD? A day that is not on the calendar, like February 30, is not rolled over into the next month. */
function isDay(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00`);
  return !Number.isNaN(d.getTime()) && d.getFullYear() === Number(s.slice(0, 4)) && d.getMonth() + 1 === Number(s.slice(5, 7)) && d.getDate() === Number(s.slice(8));
}

/** Is this the address of a page on the web: one that starts with https:// or http://, and that a browser can read? */
const isUrl = (s: string): boolean => /^https?:\/\/./.test(s) && URL.canParse(s);

/** What a key holds. */
type Kind = 'text' | 'flag' | 'day' | 'url' | 'state' | 'list' | 'ids' | 'object';
/** The keys each piece of the file may have, and what each holds. */
const PIECES = {
  roadmap: { title: 'text', about: 'text', branches: 'list', icons: 'object' },
  branch: { name: 'text', ends: 'flag', holds: 'text', private: 'flag', items: 'list' },
  split: { split: 'list', name: 'text', branching: 'flag', private: 'flag' },
  node: {
    id: 'text', name: 'text', state: 'state', why: 'text', doneWhen: 'text', icon: 'text', milestone: 'flag', private: 'flag',
    start: 'day', end: 'day', deadline: 'day', waitsFor: 'ids', waitsForPrivate: 'flag', links: 'list',
  },
  link: { name: 'text', url: 'url', icon: 'text' },
} satisfies Record<string, Record<string, Kind>>;
type Piece = keyof typeof PIECES;
/** The keys each piece must have, each a text that is not empty or a list. */
const NEEDS: Record<Piece, string[]> = { roadmap: ['title', 'branches'], branch: ['items'], split: [], node: ['id', 'name'], link: ['name', 'url'] };
const WRITTEN: readonly string[] = STATES.filter(s => s !== 'blocked');

/** The error of a value of a key, if it has one. */
function wrong(kind: Kind, v: unknown): ErrorName | undefined {
  switch (kind) {
    case 'text': return typeof v === 'string' ? undefined : 'Wrong type';
    case 'flag': return typeof v === 'boolean' ? undefined : 'Wrong type';
    case 'day': return typeof v !== 'string' ? 'Wrong type' : isDay(v) ? undefined : 'Invalid date';
    case 'url': return typeof v !== 'string' ? 'Wrong type' : isUrl(v) ? undefined : 'Invalid URL';
    case 'state': return typeof v !== 'string' ? 'Wrong type' : WRITTEN.includes(v) ? undefined : 'Invalid value';
    case 'list': case 'ids': return Array.isArray(v) ? undefined : 'Wrong type';
    case 'object': return isObject(v) ? undefined : 'Wrong type';
  }
}

/** A value as the file writes it, on one line, cut short when it is long. */
const written = (v: unknown): string => cut(JSON.stringify(v) ?? String(v));

/** Where a value is in the file: the keys and the places in lists that lead to it from the top. */
type At = (string | number)[];
const named = (v: unknown): v is string => typeof v === 'string' && v !== '';

/** Finds every error of a roadmap given as data, in the order of the file. `lineOf` gives the line of a value. */
function check(data: unknown, lineOf: (at: At) => number): FileError[] {
  const errors: FileError[] = [];
  const add = (at: At, where: string[], key: string, error: ErrorName, ...value: unknown[]): void => {
    errors.push({ line: lineOf(at), path: where.join(' › '), key, error, value: value.length ? written(value[0]) : '' });
  };
  // where each id is, to find those used more than once once the walk is over
  const ids = new Map<string, { at: At; where: string[] }[]>();
  // what each node waits for is checked once every id is known
  const waits: { at: At; where: string[]; id?: string; on: unknown[] }[] = [];

  /** Each key a piece has, and each key it needs. */
  function keys(o: Record<string, unknown>, piece: Piece, at: At, where: string[]): void {
    const kinds: Record<string, Kind> = PIECES[piece];
    for (const [key, v] of Object.entries(o)) {
      if (!Object.hasOwn(kinds, key)) {
        add([...at, key], where, key, 'Unknown key');
        continue;
      }
      const error = wrong(kinds[key], v) ?? (v === '' && NEEDS[piece].includes(key) ? 'Invalid value' : undefined);
      if (error) add([...at, key], where, key, error, v);
      else if (kinds[key] === 'ids') (v as unknown[]).forEach((w, j) => typeof w !== 'string' && add([...at, key, j], where, key, 'Wrong type', w));
    }
    for (const key of NEEDS[piece]) if (o[key] === undefined) add(at, where, key, 'Missing key');
  }

  function branch(b: unknown, at: At, where: string[]): void {
    if (!isObject(b)) return add(at, where, '', 'Wrong type', b);
    keys(b, 'branch', at, where);
    if (Array.isArray(b.items)) b.items.forEach((it, i) => item(it, [...at, 'items', i], where));
  }

  function item(it: unknown, at: At, where: string[]): void {
    if (!isObject(it)) return add(at, where, '', 'Wrong type', it);
    if ('split' in it) {
      const here = named(it.name) ? [...where, it.name] : where;
      keys(it, 'split', at, here);
      if (!Array.isArray(it.split)) return;
      if (!it.split.length) add([...at, 'split'], here, 'split', 'Invalid value', it.split);
      it.split.forEach((b, j) => branch(b, [...at, 'split', j], isObject(b) && named(b.name) ? [...here, b.name] : here));
      return;
    }
    const id = named(it.id) ? it.id : undefined;
    const here = named(it.name) ? [...where, it.name] : id ? [...where, id] : where;
    keys(it, 'node', at, here);
    if (id) ids.set(id, [...(ids.get(id) ?? []), { at: [...at, 'id'], where: here }]);
    if (Array.isArray(it.waitsFor)) waits.push({ at: [...at, 'waitsFor'], where: here, id, on: it.waitsFor });
    if (Array.isArray(it.links)) it.links.forEach((l, j) => link(l, [...at, 'links', j], here));
  }

  /** A link of a step: its path goes on to its name, where it has one. */
  function link(l: unknown, at: At, where: string[]): void {
    if (!isObject(l)) return add(at, where, '', 'Wrong type', l);
    keys(l, 'link', at, named(l.name) ? [...where, l.name] : where);
  }

  if (!isObject(data)) {
    add([], [], '', 'Wrong type', data);
    return errors;
  }
  keys(data, 'roadmap', [], []);
  if (Array.isArray(data.branches)) {
    if (!data.branches.length) add(['branches'], [], 'branches', 'Invalid value', data.branches);
    // a top-level branch with no name goes by its place, as '#2'
    data.branches.forEach((b, i) => branch(b, ['branches', i], [isObject(b) && named(b.name) ? b.name : `#${i + 1}`]));
  }
  // an id used more than once: an error on each line it is on
  for (const [id, all] of ids) {
    if (all.length < 2) continue;
    const lines = new Set<number>();
    for (const { at, where } of all) {
      if (lines.has(lineOf(at))) continue;
      lines.add(lineOf(at));
      add(at, where, 'id', 'Duplicate id', id);
    }
  }
  for (const w of waits) {
    w.on.forEach((id, j) => {
      if (typeof id !== 'string') return;
      if (id === w.id) add([...w.at, j], w.where, 'waitsFor', 'Invalid value', id);
      else if (!ids.has(id)) add([...w.at, j], w.where, 'waitsFor', 'Unknown id', id);
    });
  }
  return errors.sort((a, b) => a.line - b.line);
}

/** Checks the text of a roadmap file: every error, in the order of the file, each with its line. A text that is not JSON has one, where it breaks. */
export function checkRoadmap(text: string): { roadmap?: Roadmap; errors: FileError[] } {
  let lines: Map<string, number>, data: unknown;
  try {
    lines = scan(text);
    data = JSON.parse(text);
  } catch (e) {
    return { errors: [{ line: e instanceof Broken ? e.line : 1, path: '', key: '', error: 'Invalid JSON', value: e instanceof Broken ? e.value : '' }] };
  }
  const errors = check(data, at => lines.get(JSON.stringify(at)) ?? 1);
  return errors.length ? { errors } : { roadmap: data as Roadmap, errors };
}

/** Checks a roadmap given as data. Throws its first error, with no line, as data has none. */
export function parseRoadmap(data: unknown): Roadmap {
  const [first] = check(data, () => 0);
  if (first) throw new Error(sayError(first).trim());
  return data as Roadmap;
}

/** A text that is not JSON: the line where it breaks, and the text there that it cannot take. */
class Broken extends Error {
  line: number;
  value: string;
  constructor(line: number, value: string) {
    super('Invalid JSON');
    this.line = line;
    this.value = value;
  }
}

/** The line of each value of a JSON text, by its `At` as JSON: of a key, the line of the key; of an item of a list, the line it starts on.
 * Throws Broken where the text is not JSON. */
function scan(text: string): Map<string, number> {
  const lines = new Map<string, number>();
  let i = 0, line = 1, comma = 1;
  const broken = (at = line, value = ''): never => {
    throw new Broken(at, cut(value));
  };
  // the piece of text at i: a text in quotes, a word or a number, or one sign; nothing at the end of the file
  const TOKEN = /"(?:[^"\\\n]|\\.)*"?|[\w$.+-]+|\S/uy;
  const token = (): string => {
    TOKEN.lastIndex = i;
    return TOKEN.exec(text)?.[0] ?? '';
  };
  const odd = (): never => broken(line, token());
  const blank = (): void => {
    for (; i < text.length; i++) {
      if (text[i] === '\n') line++;
      else if (text[i] !== ' ' && text[i] !== '\t' && text[i] !== '\r') return;
    }
  };
  const string = (): string => {
    const from = i, at = line;
    for (i++; i < text.length; i++) {
      const c = text[i];
      if (c === '"') return JSON.parse(text.slice(from, ++i)) as string;
      if (c === '\\') {
        i++;
        if (text[i] === 'u' ? !/^[0-9a-fA-F]{4}$/.test(text.slice(i + 1, i + 5)) : !'"\\/bfnrt'.includes(text[i] || '?')) {
          broken(at, text.slice(i - 1, text[i] === 'u' ? i + 5 : i + 1).trimEnd());
        }
        if (text[i] === 'u') i += 4;
      } else if (c < ' ') broken(at, c === '\n' ? text.slice(from, i).trimEnd() : JSON.stringify(c).slice(1, -1));
    }
    return broken(at, text.slice(from, i).split('\n')[0].trimEnd());
  };
  const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

  function value(at: At): void {
    blank();
    const c = text[i];
    if (c === '{' || c === '[') {
      const list = c === '[', close = list ? ']' : '}';
      i++;
      blank();
      if (text[i] === close) return void i++;
      for (let n = 0; ; n++) {
        blank();
        if (text[i] === close) broken(comma, ',');
        if (list) {
          lines.set(JSON.stringify([...at, n]), line);
          value([...at, n]);
        } else {
          if (text[i] !== '"') return odd();
          const keyLine = line, key = string();
          lines.set(JSON.stringify([...at, key]), keyLine);
          blank();
          if (text[i] !== ':') broken();
          i++;
          value([...at, key]);
        }
        const end = line;
        blank();
        if (text[i] === close) return void i++;
        if (text[i] !== ',') return i >= text.length ? odd() : broken(end);
        comma = line;
        i++;
      }
    }
    if (c === '"') return void string();
    if (c === '-' || (c >= '0' && c <= '9')) {
      NUMBER.lastIndex = i;
      const m = NUMBER.exec(text);
      if (!m || /[.eE\d]/.test(text[i + m[0].length] ?? '')) broken(line, token());
      i += m![0].length;
      return;
    }
    for (const word of ['true', 'false', 'null']) if (text.startsWith(word, i)) return void (i += word.length);
    odd();
  }

  if (!text.trim()) broken();
  blank();
  lines.set('[]', line);
  value([]);
  blank();
  if (i < text.length) broken(line, token());
  return lines;
}
