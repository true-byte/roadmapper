// The roadmap a stranger sees: the export cuts every private item out of it, with all that is in it, and leaves no gap, lock or count.
// One trace is left: a shown step that waits for private work not done yet says so, with `waitsForPrivate`, and the view draws it blocked, by nothing it names.
// No step keeps its days either, so a stranger cannot tell what is late.
// Only the export runs this. The view never does: it draws all it is given.
import { parseRoadmap } from './check.js';
import { RoadmapError } from './errors.js';
import type { Branch, Item, RoadNode, Roadmap, Split, State } from './types.js';

/** The keys of a step that a stranger may read: not its days. A key the file check does not know is never copied. */
const NODE_KEYS = ['id', 'name', 'state', 'why', 'doneWhen', 'icon', 'milestone', 'links'] as const;

const isPrivate = (x: { private?: unknown }): boolean => x.private === true;
const over = (s: State | undefined): boolean => s === 'done' || s === 'canceled';

interface Seen {
  node: RoadNode;
  /** Is it cut: private, or in a private branch or group? */
  cut: boolean;
  /** The steps right before it on its line, which it waits for. */
  before: RoadNode[];
}

/** Every step of the owner's roadmap, by id: whether the cut takes it, and the steps right before it on its line. */
function look(r: Roadmap): Map<string, Seen> {
  const seen = new Map<string, Seen>();
  function walk(b: Branch, before: RoadNode[], cut: boolean): RoadNode[] {
    const c = cut || isPrivate(b);
    let last = before;
    for (const it of b.items) {
      if ('split' in it) {
        const ci = c || isPrivate(it);
        const outs = it.split.map(k => ({ k, last: walk(k, last, ci) }));
        const joining = outs.filter(o => !o.k.ends);
        if (joining.length) last = joining.flatMap(o => o.last);
      } else {
        seen.set(it.id, { node: it, cut: c || isPrivate(it), before: last });
        last = [it];
      }
    }
    return last;
  }
  // no line runs from one top-level branch to the next
  for (const b of r.branches) walk(b, [], false);
  return seen;
}

/** The ids of the shown steps that the cut makes blocked. By `waitsFor`: any open step that waits for a cut step not done, as the view does for the owner.
 * By its line: a step not started, when the open steps right before it, looking past canceled ones, are all cut. */
function blockedByCut(seen: Map<string, Seen>): Set<string> {
  const out = new Set<string>();
  for (const [id, s] of seen) {
    const state = s.node.state ?? 'todo';
    if (s.cut || over(state)) continue;
    if ((s.node.waitsFor ?? []).some(w => seen.get(w)!.cut && !over(seen.get(w)!.node.state))) {
      out.add(id);
      continue;
    }
    // a step in progress has started, so nothing holds it
    if (state !== 'todo' && state !== 'tbd') continue;
    let cut = false, shown = false;
    const met = new Set<string>();
    const back = (list: RoadNode[]): void => {
      for (const p of list) {
        if (met.has(p.id)) continue;
        met.add(p.id);
        const ps = seen.get(p.id)!, st = p.state ?? 'todo';
        if (st === 'done') continue;
        // a canceled step holds nothing: what it waited for is what holds this one
        if (st === 'canceled') back(ps.before);
        else if (ps.cut) cut = true;
        else shown = true;
      }
    };
    back(s.before);
    if (cut && !shown) out.add(id);
  }
  return out;
}

/** The roadmap a stranger sees, from a checked roadmap. Private branches, groups, branchings and steps go, with all that is in them, and so do the groups and branches
 * that are left empty. A branching keeps `"branching": true`; one left with a single line that comes back is only its steps, in the row. A step keeps only the keys a stranger
 * may read, and waits only for shown steps. The ids are new, s1, s2 and on in reading order, so no id tells of a step that is not there.
 * Throws the error 'Nothing public' when everything is private. */
export function publicRoadmap(r: Roadmap): Roadmap {
  const seen = look(r);
  const blocked = blockedByCut(seen);
  const kept: RoadNode[] = [];

  function branch(b: Branch): Branch | null {
    if (isPrivate(b)) return null;
    const left = items(b.items);
    if (!left.length && b.items.length) return null;
    const out = {} as Branch;
    if (b.name !== undefined) out.name = b.name;
    if (b.ends !== undefined) out.ends = b.ends;
    if (b.holds !== undefined) out.holds = b.holds;
    out.items = left;
    return out;
  }
  function items(list: Item[]): Item[] {
    const out: Item[] = [];
    for (const it of list) {
      if (isPrivate(it)) continue;
      if ('split' in it) {
        const kids = it.split.flatMap(k => branch(k) ?? []);
        if (!kids.length) continue;
        const branching = it.branching === true || it.split.some(k => k.ends);
        if (branching && it.split.length > 1 && kids.length === 1 && !kids[0].ends) {
          out.push(...kids[0].items);
          continue;
        }
        const sp: Split = { split: kids };
        if (it.name !== undefined) sp.name = it.name;
        if (branching) sp.branching = true;
        out.push(sp);
        continue;
      }
      const n = {} as Record<string, unknown>;
      for (const k of NODE_KEYS) if (it[k] !== undefined) n[k] = it[k];
      if (blocked.has(it.id)) n.waitsForPrivate = true;
      if (it.waitsFor) n.waitsFor = [...it.waitsFor];
      kept.push(n as unknown as RoadNode);
      out.push(n as unknown as RoadNode);
    }
    return out;
  }

  const branches = r.branches.flatMap(b => branch(b) ?? []);
  if (!branches.length) throw new RoadmapError('Nothing public', 'everything is private: there is nothing to show');
  const ids = new Map(kept.map((n, i) => [n.id, `s${i + 1}`]));
  for (const n of kept) {
    n.id = ids.get(n.id)!;
    const waits = (n.waitsFor ?? []).flatMap(w => ids.get(w) ?? []);
    if (waits.length) n.waitsFor = waits;
    else delete n.waitsFor;
  }
  const out: Roadmap = { title: r.title, branches };
  if (r.about !== undefined) out.about = r.about;
  return parseRoadmap(out);
}
