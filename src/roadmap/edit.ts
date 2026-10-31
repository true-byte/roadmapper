// The edit model of 'Edit on page': each change the page makes to a roadmap, as a function that takes the roadmap and gives a new one, or refuses the change.
// A change never changes the roadmap it is given. Every roadmap it gives passes the file check; a change the check refuses gives the errors of the check.
// A branch and a split go by the key the view gives them: 'b0' for the first top-level branch, 'b0.2' for the split that is item 2 of it, 'b0.2.1' for branch 1 of that split.
// A step goes by its id.
import { dataErrors } from './check.js';
import { cut, type ErrorName, type FileError } from './errors.js';
import type { Branch, Item, RoadNode, Roadmap, Split } from './types.js';

/** A gap of a branch, where an item can go: before its item `index`, or after its last item when `index` is the number of its items. */
export interface Slot {
  branch: string;
  index: number;
}

/** A change the file check takes. */
export interface Done {
  ok: true;
  roadmap: Roadmap;
  /** The step to pick after the change, by its id now: the first new step, or the step that moved or changed. */
  step?: string;
  /** The key now of the branch or the split that moved. */
  key?: string;
}
/** A change refused: the errors of the file check, or the one error of a step, a branch, a split or a slot that the roadmap does not have. */
export interface Refused {
  ok: false;
  errors: FileError[];
}
/** What a change gives. A refused change leaves the roadmap as it was. */
export type Edited = Done | Refused;

/** What the add choice adds at a gap: a step, a branching of two branches, or a group of one track. Each new branch and track holds one new step. */
export type NewItem = 'step' | 'branching' | 'group';

/** The keys of a step that the side bar sets: every key of the file format but `id`, which comes from the name, and `waitsForPrivate`, which only the export writes. */
export type StepField = Exclude<keyof RoadNode, 'id' | 'waitsForPrivate'>;
export type BranchField = 'name' | 'holds' | 'ends' | 'private';
export type SplitField = 'name' | 'branching' | 'private';

/** The names a new piece gets. */
const NEW = { step: 'New step', branch: 'New branch', track: 'New track', group: 'New group' };

/** Where each step is, the split each branch of a split is in, and the branch each split is an item of. */
interface Tree {
  steps: Map<string, { node: RoadNode; in: Branch }>;
  up: Map<Branch, Split>;
  owner: Map<Split, Branch>;
}
function walk(r: Roadmap): Tree {
  const t: Tree = { steps: new Map(), up: new Map(), owner: new Map() };
  const go = (b: Branch): void => {
    for (const it of b.items) {
      if (!('split' in it)) {
        t.steps.set(it.id, { node: it, in: b });
        continue;
      }
      t.owner.set(it, b);
      for (const k of it.split) {
        t.up.set(k, it);
        go(k);
      }
    }
  };
  r.branches.forEach(go);
  return t;
}

/** The branch with this key. */
function branchAt(r: Roadmap, key: string): Branch | undefined {
  if (!/^b\d+(\.\d+\.\d+)*$/.test(key)) return undefined;
  const [top, ...at] = key.slice(1).split('.').map(Number);
  let b: Branch | undefined = r.branches[top];
  for (let i = 0; b && i < at.length; i += 2) {
    const it: Item | undefined = b.items[at[i]];
    b = it && 'split' in it ? it.split[at[i + 1]] : undefined;
  }
  return b;
}
/** The split with this key. */
function splitAt(r: Roadmap, key: string): Split | undefined {
  const m = /^(.+)\.(\d+)$/.exec(key);
  const it = m ? branchAt(r, m[1])?.items[Number(m[2])] : undefined;
  return it && 'split' in it ? it : undefined;
}
/** The key of a branch or a split of a roadmap. */
function keyOf(r: Roadmap, piece: Branch | Split): string | undefined {
  let found: string | undefined;
  const go = (b: Branch, key: string): void => {
    if (b === piece) found = key;
    b.items.forEach((it, i) => {
      if (!('split' in it)) return;
      if (it === piece) found = `${key}.${i}`;
      it.split.forEach((k, j) => go(k, `${key}.${i}.${j}`));
    });
  };
  r.branches.forEach((b, i) => go(b, `b${i}`));
  return found;
}

const refuse = (key: string, error: ErrorName, value: unknown): Edited => ({ ok: false, errors: [{ line: 0, path: '', key, error, value: cut(JSON.stringify(value)) }] });
/** A step that the roadmap does not have. */
const unknown = (id: string): Edited => refuse('id', 'Unknown id', id);
/** A branch, a split or a slot that the roadmap does not have. */
const nowhere = (place: unknown): Edited => refuse('', 'Invalid value', place);
/** Is `index` a place in a list of `n`: before one of its items, or after the last? */
const fits = (n: number, index: number): boolean => Number.isInteger(index) && index >= 0 && index <= n;

/** The roadmap after a change, when the file check takes it. */
function done(d: Roadmap, more: { step?: string; key?: string } = {}): Edited {
  const errors = dataErrors(d);
  return errors.length ? { ok: false, errors } : { ok: true, roadmap: d, ...more };
}

/** Sets a key of a piece. A value that says nothing takes the key out: none, false, a blank text or an empty list. */
function put(piece: object, key: string, value: unknown): void {
  const o = piece as Record<string, unknown>;
  if (value === undefined || value === false || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length)) delete o[key];
  else o[key] = structuredClone(value);
}

/** Takes an item out of its branch. A branch left with no item goes, and so does a split left with no branch, up to the top-level branches. */
function take(d: Roadmap, t: Tree, b: Branch, it: Item): void {
  b.items.splice(b.items.indexOf(it), 1);
  for (let at = b; !at.items.length; ) {
    const sp = t.up.get(at);
    if (!sp) {
      d.branches.splice(d.branches.indexOf(at), 1);
      return;
    }
    sp.split.splice(sp.split.indexOf(at), 1);
    if (sp.split.length) return;
    at = t.owner.get(sp)!;
    at.items.splice(at.items.indexOf(sp), 1);
  }
}

/** Moves an item of `from` to a slot of `d`: false when the slot is on either side of the item, where it is already. */
function moveItem(d: Roadmap, t: Tree, it: Item, from: Branch, to: Slot): boolean | Edited {
  const into = branchAt(d, to.branch);
  if (!into || !fits(into.items.length, to.index)) return nowhere(to);
  const i = from.items.indexOf(it);
  if (into === from && (to.index === i || to.index === i + 1)) return false;
  // a hole keeps the place of the item until it is in its new place, so the index of the slot still holds
  const hole = {} as Item;
  from.items[i] = hole;
  into.items.splice(to.index, 0, it);
  take(d, t, from, hole);
  return true;
}

/** Makes new steps, named 'New step' unless told, with ids unique in `d` and in `old`. */
function maker(d: Roadmap, old: ReadonlySet<string>): (name?: string) => RoadNode {
  const taken = new Set([...walk(d).steps.keys(), ...old]);
  return (name = NEW.step) => {
    const id = idFor(name, taken);
    taken.add(id);
    return { id, name };
  };
}

/** The id of a step from its name, as the roadmapper skill makes ids: the words of the name in lowercase, joined by '-'. When that id is taken, '-2' is added, then '-3' and on.
 * A name with no word gives 'step'. */
export function idFor(name: string, taken: ReadonlySet<string>): string {
  const words = name.toLowerCase().replace(/['’]/g, '').match(/[\p{L}\p{M}\p{N}]+/gu);
  const base = words?.join('-') || 'step';
  let id = base;
  for (let k = 2; taken.has(id); k++) id = `${base}-${k}`;
  return id;
}

/** Moves a step to a slot of any branch. */
export function moveStep(r: Roadmap, id: string, to: Slot): Edited {
  const d = structuredClone(r), t = walk(d), at = t.steps.get(id);
  if (!at) return unknown(id);
  const moved = moveItem(d, t, at.node, at.in, to);
  if (typeof moved === 'object') return moved;
  return moved ? done(d, { step: id }) : { ok: true, roadmap: r, step: id };
}

/** Moves a group or a branching as one piece, with all it holds, to a slot of any branch but its own branches. */
export function moveSplit(r: Roadmap, key: string, to: Slot): Edited {
  const d = structuredClone(r), t = walk(d), sp = splitAt(d, key);
  if (!sp) return nowhere(key);
  for (let b = branchAt(d, to.branch); b; ) {
    const up = t.up.get(b);
    if (up === sp) return nowhere(to);
    b = up && t.owner.get(up);
  }
  const moved = moveItem(d, t, sp, t.owner.get(sp)!, to);
  if (typeof moved === 'object') return moved;
  return moved ? done(d, { key: keyOf(d, sp) }) : { ok: true, roadmap: r, key };
}

/** Moves a branch, with all it holds, among its sisters: the branches of its branching, the tracks of its group, or the top-level branches.
 * `index` is a place among them as they are before the move: before the sister at `index`, or after the last. */
export function moveBranch(r: Roadmap, key: string, index: number): Edited {
  const d = structuredClone(r), b = branchAt(d, key);
  const sisters = b && (walk(d).up.get(b)?.split ?? d.branches);
  if (!b || !sisters || !fits(sisters.length, index)) return nowhere({ branch: key, index });
  const i = sisters.indexOf(b);
  if (index === i || index === i + 1) return { ok: true, roadmap: r, key };
  sisters.splice(i, 1);
  sisters.splice(index > i ? index - 1 : index, 0, b);
  return done(d, { key: keyOf(d, b) });
}

/** Adds a step, a branching of two branches, or a group of one track, at a slot. `old` holds ids that no new step may take: see EditHistory.old. */
export function addItem(r: Roadmap, to: Slot, kind: NewItem, old: ReadonlySet<string> = new Set()): Edited {
  const d = structuredClone(r), into = branchAt(d, to.branch);
  if (!into || !fits(into.items.length, to.index)) return nowhere(to);
  const step = maker(d, old), first = step();
  const it: Item = kind === 'step' ? first
    : kind === 'branching' ? { branching: true, split: [{ name: NEW.branch, items: [first] }, { name: NEW.branch, items: [step()] }] }
    : { name: NEW.group, split: [{ items: [first] }] };
  into.items.splice(to.index, 0, it);
  return done(d, { step: first.id });
}

/** Adds a branch to a split, at `index` among its branches, with one new step. In a group, it is a track. */
export function addBranch(r: Roadmap, key: string, index: number, old: ReadonlySet<string> = new Set()): Edited {
  const d = structuredClone(r), sp = splitAt(d, key);
  if (!sp || !fits(sp.split.length, index)) return nowhere({ split: key, index });
  const s = maker(d, old)();
  const group = sp.branching !== true && sp.split.every(b => !b.ends);
  sp.split.splice(index, 0, { name: group ? NEW.track : NEW.branch, items: [s] });
  return done(d, { step: s.id });
}

/** Adds a top-level branch after the last one, with one new step. */
export function addTop(r: Roadmap, old: ReadonlySet<string> = new Set()): Edited {
  const d = structuredClone(r), s = maker(d, old)();
  d.branches.push({ name: NEW.branch, items: [s] });
  return done(d, { step: s.id });
}

/** Deletes a step. It goes from every `waitsFor` too. A branch left with no item goes, and so does a split left with no branch.
 * The last step of the roadmap cannot go: a roadmap needs a branch. */
export function deleteStep(r: Roadmap, id: string): Edited {
  const d = structuredClone(r), t = walk(d), at = t.steps.get(id);
  if (!at) return unknown(id);
  take(d, t, at.in, at.node);
  for (const { node } of t.steps.values()) if (node.waitsFor?.includes(id)) put(node, 'waitsFor', node.waitsFor.filter(w => w !== id));
  return done(d);
}

/** Sets a key of a step. A value that says nothing takes the key out: none, false, a blank text or an empty list; and so does the state 'todo', as a step with no state is to do.
 * A new step, one whose id `old` does not hold, gets the id of its new name, and every `waitsFor` follows it. */
export function setStep<K extends StepField>(r: Roadmap, id: string, key: K, value: RoadNode[K], old?: ReadonlySet<string>): Edited {
  const d = structuredClone(r), t = walk(d), at = t.steps.get(id);
  if (!at) return unknown(id);
  const n = at.node;
  put(n, key, key === 'state' && value === 'todo' ? undefined : value);
  let now = id;
  if (key === 'name' && old && !old.has(id) && typeof n.name === 'string') {
    now = idFor(n.name, new Set([...t.steps.keys(), ...old].filter(x => x !== id)));
    n.id = now;
    for (const { node } of t.steps.values()) if (node.waitsFor) node.waitsFor = node.waitsFor.map(w => (w === id ? now : w));
  }
  return done(d, { step: now });
}

/** Sets a key of a branch, as setStep does. */
export function setBranch<K extends BranchField>(r: Roadmap, key: string, field: K, value: Branch[K]): Edited {
  const d = structuredClone(r), b = branchAt(d, key);
  if (!b) return nowhere(key);
  put(b, field, value);
  return done(d);
}

/** Sets a key of a group or a branching, as setStep does. */
export function setSplit<K extends SplitField>(r: Roadmap, key: string, field: K, value: Split[K]): Edited {
  const d = structuredClone(r), sp = splitAt(d, key);
  if (!sp) return nowhere(key);
  put(sp, field, value);
  return done(d);
}

/** Do two values hold the same, in any order of keys? */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), o = b as Record<string, unknown>;
  return ka.length === Object.keys(b).length && ka.every(k => Object.hasOwn(o, k) && same((a as Record<string, unknown>)[k], o[k]));
}

/** The roadmaps since 'Edit', to undo and redo the changes. A change of the same field as the change before it, such as each key typed in a name, joins that change. */
export class EditHistory {
  /** The ids of the steps of the roadmap at 'Edit'. A step with any other id is new: its id follows its name. No new step takes one of these ids. */
  readonly old: ReadonlySet<string>;
  private readonly start: Roadmap;
  private readonly list: Roadmap[];
  private at = 0;
  /** The field of the last change, while a change of that field joins it. */
  private joins?: string;

  constructor(start: Roadmap) {
    this.start = structuredClone(start);
    this.list = [this.start];
    this.old = new Set(walk(start).steps.keys());
  }
  /** The roadmap now. */
  get now(): Roadmap {
    return this.list[this.at];
  }
  /** Does the roadmap now differ from the one at 'Edit'? An undo back to it leaves no change. */
  get changed(): boolean {
    return !same(this.now, this.start);
  }
  get canUndo(): boolean {
    return this.at > 0;
  }
  get canRedo(): boolean {
    return this.at < this.list.length - 1;
  }
  /** Keeps a changed roadmap as the one now, and drops the changes that could be redone. A roadmap that holds what the one now holds is no change.
   * `field` names what the change set, such as 'name make-the-sign': the next change of the same field joins this one. */
  push(r: Roadmap, field?: string): void {
    if (same(r, this.now)) return;
    if (field && field === this.joins) {
      this.list[this.at] = r;
      // set back to what it was before: the joined change is no change
      if (same(r, this.list[this.at - 1])) {
        this.list.pop();
        this.at--;
        this.joins = undefined;
      }
      return;
    }
    this.list.splice(this.at + 1);
    this.list.push(r);
    this.at++;
    this.joins = field;
  }
  /** Goes back one change, and gives the roadmap now. */
  undo(): Roadmap {
    if (this.canUndo) this.at--;
    this.joins = undefined;
    return this.now;
  }
  /** Goes on to the change an undo went back from, and gives the roadmap now. */
  redo(): Roadmap {
    if (this.canRedo) this.at++;
    this.joins = undefined;
    return this.now;
  }
}
