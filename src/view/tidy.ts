// A tidy place: where the page puts the plan by itself, at the first view and after a press of the zoom control or a key, nothing is cut in two at an edge.
import type { ViewContext } from './context.js';
import { drawn } from './draw.js';
import type { Layout } from './layout.js';
import { clamp, union } from './math.js';
import { isKids, isTrack, tracksOf } from './plan.js';

/** What must show whole or not at all: each step that is drawn, with its name; each group that is one step, with its name; the pill of each closed track;
 * each name of a branch or of a group, and each count; and the top of each open group, since its name is over it. Their boxes on the screen now, by a key.
 * A step or a group step also has its name and its body apart: a body cut with its name whole is a smaller fault than a name cut, or a body whose name is out of sight. */
export interface Box { l: number; t: number; r: number; b: number }

export interface Whole extends Box { key: string; cost: number; top: boolean; name?: Box; body?: Box; side?: boolean }

export function tidyPart(ctx: ViewContext) {
  const { popup, side, stage, zoom } = ctx;

  function wholes(): Whole[] {
    const out: Whole[] = [];
    const L = ctx.views[ctx.view][ctx.target];
    const shows = (e: Element | undefined): e is SVGElement => drawn(e) && Number(e.getAttribute('opacity') ?? 1) > 0.5;
    const box = (es: (Element | undefined)[]): Box | undefined => {
      const rs = es.filter(shows).map(e => e.getBoundingClientRect()).filter(r => r.width || r.height);
      if (!rs.length) return undefined;
      const u = union(rs);
      return { l: u.left, t: u.top, r: u.right, b: u.bottom };
    };
    const add = (key: string, es: (Element | undefined)[], cost: number, top = false, name?: Box, body?: Box, side = false): void => {
      const b = box(es);
      if (b) out.push({ key, ...b, cost, top, name, body, side });
    };
    // down, the name of a branch is the top of its first step: a column is never in sight with its name cut off. Of what it names, by its key
    const capOf = new Map<string, Element>();
    if (L.turned) for (const [k, p] of L.pieces) {
      if (p.t !== 'cap' || p.o < 0.5) continue;
      const first = p.of.items[0];
      const key = !first ? '' : !isKids(first) ? `n:${first.node.id}` : ctx.byPod.has(first.key) && (L.pods.get(first.key)?.o ?? 0) > 0.5 ? `p:${first.key}` : '';
      if (key) capOf.set(key, ctx.pieceEls.get(k)!);
    }
    const capped = new Set(capOf.values());
    for (const n of ctx.all) {
      const e = ctx.nodeEls.get(n.node.id)!, key = `n:${n.node.id}`, cap = capOf.get(key);
      if (shows(e.g)) add(key, [e.coin, e.ring, e.mark, ...e.lines, ...e.vlines, cap], 10, false, box([...e.lines, ...e.vlines, cap]), box([e.coin, e.ring, e.mark]));
    }
    for (const sp of ctx.pods) {
      const e = ctx.podEls.get(sp.key)!, key = `p:${sp.key}`, cap = capOf.get(key);
      if (shows(e.g)) add(key, [e.coin, e.mark, ...e.lines, ...e.vlines, cap], 10, false, box([...e.lines, ...e.vlines, cap]), box([e.coin, e.mark]));
    }
    for (const [k, p] of L.pieces) {
      const e = ctx.pieceEls.get(k);
      if (p.t === 'bar') add(`b:${p.of.key}`, [e, ctx.pieceEls.get(`${p.of.key}:tally`)], 6);
      else if (p.t === 'cap' || p.t === 'gname' || p.t === 'txt') { if (!capped.has(e!)) add(`t:${k}`, [e], 10); }
      // the top of a frame is where its name is: the frame and its name show together. Down, a frame is a column, and is not cut at a side either
      else if (p.t === 'frame') {
        const gname = ctx.pieceEls.get(k.replace(/:frame$/, ':gname'));
        add(`f:${k}`, [e, gname], 8, true, box([gname]), undefined, L.turned);
      }
    }
    return out;
  }
  /** Tidies the place of the plan: the move from where it is now, as far as `reach` and the ends of the plan allow, that cuts the least in two at the edges of the stage
   * and at the zoom control or the side bar over it, and of those the shortest. The step `id` stays whole and in sight, and so does what `must` names; `ok` says where else that step may go, in the room.
   * Where `fresh` names what a press that goes in brings, and none of it is in sight, the move shows one whole if it can, with at least the body of the step in sight.
   * With `past`, a plan bigger than the room may go past its ends, as far as `reach`, by a move that takes nothing whole out of sight: near an end, an edge of the room can then fall where it cuts nothing. */
  function tidyPlace(L: Layout, id: string, o: { reach: [number, number]; per: number; gain?: number; keep?: boolean; past?: boolean; ok?: (x: number, y: number) => boolean; must?: string[]; fresh?: Set<string> }): [number, number] {
    const st = stage.getBoundingClientRect(), V = { l: st.left, t: st.top, r: st.left + stage.clientWidth, b: st.top + stage.clientHeight };
    const over = [zoom, ...(side.hidden ? [] : [side]), ...(popup.hidden ? [] : [popup])].map(e => e.getBoundingClientRect()).filter(r => r.width);
    const keep = o.keep ?? true, [hx, hy] = ctx.here(id), g = L.geo.get(id)!, most = (a: [number, number]): [number, number] => [Math.max(a[0], o.reach[0]), Math.max(a[1], o.reach[1])];
    const [ax, ay] = ctx.ends(L, keep, o.past ? { near: most(ctx.beyond.near), far: most(ctx.beyond.far) } : ctx.beyond);
    // the corner of the plan now, in the room, and how far it may go; and where its far end is at the far side of the room
    const cx = hx - g.x * L.s, cy = hy - g.y * L.s, [fx, fy] = ctx.ends(L, keep, { near: [0, 0], far: [0, 0] });
    const rx: [number, number] = [Math.max(-o.reach[0], ax[0] - cx), Math.min(o.reach[0], ax[1] - cx)];
    const ry: [number, number] = [Math.max(-o.reach[1], ay[0] - cy), Math.min(o.reach[1], ay[1] - cy)];
    // E: how near an edge counts as at it. GONE: how far past an edge a thing must be to be out of sight, so not a pixel of its ring or of a letter shows.
    // IN: how far past an edge of the stage a thing may go and still be whole. The box of a name starts at the edge of its first letter, so a pixel past cuts that letter
    const E = 2, GONE = 1, IN = 0.5;
    // only what can come into sight in reach
    const ws = wholes().filter(w => w.r + o.reach[0] > V.l && w.l - o.reach[0] < V.r && w.b + o.reach[1] > V.t && w.t - o.reach[1] < V.b);
    // the held step, or what stands for it where it is not drawn: the pill of its closed track, or far out the step of its group
    const n = ctx.byId.get(id), standing = n ? [`n:${id}`, ...tracksOf(n.owner).map(b => `b:${b.key}`), ...(n.owner.pod ? [`p:${n.owner.pod.key}`] : [])] : [`n:${id}`];
    const held = standing.map(k => ws.find(w => w.key === k)).find(w => !!w), must = (o.must ?? []).map(k => ws.find(w => w.key === k)).filter(w => !!w);
    // what the press brings, and of it the steps, the group steps and the pills, one of which it shows whole if it can
    const brought = ws.filter(w => o.fresh?.has(w.key)), fresh = brought.filter(w => /^[npb]:/.test(w.key));
    /** 0: not in sight; 1: whole; 2: cut in two. */
    const how = (w: Box, dx: number, dy: number): number => {
      const l = w.l + dx, r = w.r + dx, t = w.t + dy, b = w.b + dy;
      const il = Math.max(l, V.l), ir = Math.min(r, V.r), it = Math.max(t, V.t), ib = Math.min(b, V.b);
      if (ir - il <= -GONE || ib - it <= -GONE) return 0;
      // what shows of it lies under the zoom control or the side bar: it is not in sight
      if (over.some(c => il >= c.left - E && ir <= c.right + E && it >= c.top - E && ib <= c.bottom + E)) return 0;
      if (l < V.l - IN || r > V.r + IN || t < V.t - IN || b > V.b + IN) return 2;
      return over.some(c => Math.min(r, c.right) - Math.max(l, c.left) > E && Math.min(b, c.bottom) - Math.max(t, c.top) > E) ? 2 : 1;
    };
    /** What a fault costs: the top of a group only where the top edge of the stage cuts it, and a body cut under a whole name less than a name. */
    const fault = (w: Whole, dx: number, dy: number): number => {
      if (w.top) {
        const t = w.t + dy, l = w.l + dx, r = w.r + dx, b = w.b + dy;
        const across = Math.min(r, V.r) - Math.max(l, V.l) > E, along = Math.min(b, V.b) - Math.max(t, V.t) > E;
        if (!across || !along) return 0;
        // its top, with its name, is cut by the top of the stage
        if (t < V.t - E) return w.cost;
        // its name lies under the zoom control or the side bar while the frame shows under it
        const n = w.name;
        if (n && how(n, dx, dy) === 0 && Math.min(n.r + dx, V.r) - Math.max(n.l + dx, V.l) > E && n.t + dy < V.b && n.b + dy > V.t) return w.cost;
        // down, a frame is cut at a side: a small fault, as a column beside the one in sight often is. Its edge alone at the edge of the stage is none
        return w.side && ((l < V.l - E && r > V.l + 12) || (r > V.r + E && l < V.r - 12)) ? 2 : 0;
      }
      if (how(w, dx, dy) !== 2) return 0;
      return w.name && w.body && how(w.name, dx, dy) === 1 ? 4 : w.cost;
    };
    const step = 3;
    let best: [number, number] = [0, 0], bestCost = Infinity, bestFresh: [number, number] | null = null, freshCost = Infinity, bestWholeFresh: [number, number] | null = null, wholeFreshCost = Infinity;
    const xs: number[] = [], ys: number[] = [];
    for (let d = Math.ceil(rx[0] / step) * step; d <= rx[1]; d += step) xs.push(d);
    for (let d = Math.ceil(ry[0] / step) * step; d <= ry[1]; d += step) ys.push(d);
    if (!xs.includes(0)) xs.push(0);
    if (!ys.includes(0)) ys.push(0);
    const ix0 = xs.indexOf(0), iy0 = ys.indexOf(0);
    // in sight and whole; an open group with its top, where its name is, in sight
    const good = (w: Whole, dx: number, dy: number): boolean =>
      w.top ? w.t + dy >= V.t - E && w.t + dy < V.b - 24 && Math.min(w.r + dx, V.r) - Math.max(w.l + dx, V.l) > 24 && fault(w, dx, dy) === 0 : how(w, dx, dy) === 1;
    // What a thing costs, and how it shows, changes only at a move where an edge of it, of its name or of its body meets a side of the stage, of the zoom control, of the side bar
    // or of the popup, or comes as near to one as the rules above look: OFF from it. So each is reckoned once for each stretch of moves between those, across and down, and looked up for every move in them.
    const OFF = [-24, -12, -E, -GONE, -IN, 0, IN, GONE, E, 12, 24];
    /** The stretch each of the moves `ds` is in, for things with these edges, against these sides: a new one starts at each move with a meeting at it or since the move before. */
    const stretch = (edges: number[], sides: number[], ds: number[]): { at: Int32Array; n: number } => {
      const meets = edges.flatMap(e => sides.flatMap(p => OFF.map(k => p + k - e))).sort((a, b) => a - b);
      const at = new Int32Array(ds.length), order = ds.map((_, i) => i).sort((a, b) => ds[a] - ds[b]);
      let n = 0, j = 0, prev = -Infinity;
      for (const i of order) {
        // a meeting between the move before and this one, or at either, a little either way so a sum that rounds is never missed
        while (j < meets.length && meets[j] < prev - 1e-6) j++;
        if (prev > -Infinity && j < meets.length && meets[j] <= ds[i] + 1e-6) n++;
        at[i] = n;
        prev = ds[i];
      }
      return { at, n: n + 1 };
    };
    const xSides = [V.l, V.r, ...over.flatMap(c => [c.left, c.right])], ySides = [V.t, V.b, ...over.flatMap(c => [c.top, c.bottom])];
    /** Of a thing: the stretch of each move, and what it costs, how it shows and how its body shows in each pair of stretches, as they are reckoned. */
    interface Memo { w: Whole; xc: Int32Array; yc: Int32Array; ny: number; cost: Float64Array; how: Int8Array; body: Int8Array }
    const memoOf = (w: Whole): Memo => {
      const bs = [w, w.name, w.body].filter((b): b is Box => !!b);
      const x = stretch(bs.flatMap(b => [b.l, b.r]), xSides, xs), y = stretch(bs.flatMap(b => [b.t, b.b]), ySides, ys), cells = x.n * y.n;
      return { w, xc: x.at, yc: y.at, ny: y.n, cost: new Float64Array(cells).fill(NaN), how: new Int8Array(cells).fill(-1), body: new Int8Array(cells).fill(-1) };
    };
    const memos = new Map(ws.map(w => [w, memoOf(w)]));
    const every = [...memos.values()], heldM = held && memos.get(held), mustM = must.map(w => memos.get(w)!), freshM = fresh.map(w => memos.get(w)!);
    const howAt = (m: Memo, ix: number, iy: number): number => {
      const k = m.xc[ix] * m.ny + m.yc[iy];
      return m.how[k] >= 0 ? m.how[k] : (m.how[k] = how(m.w, xs[ix], ys[iy]));
    };
    const bodyAt = (m: Memo, ix: number, iy: number): number => {
      const k = m.xc[ix] * m.ny + m.yc[iy];
      return m.body[k] >= 0 ? m.body[k] : (m.body[k] = how(m.w.body!, xs[ix], ys[iy]));
    };
    const costAt = (m: Memo, ix: number, iy: number): number => {
      const k = m.xc[ix] * m.ny + m.yc[iy], c = m.cost[k];
      if (c === c) return c;
      const dx = xs[ix], dy = ys[iy];
      return (m.cost[k] = fault(m.w, dx, dy) - (o.gain && good(m.w, dx, dy) ? o.gain : 0));
    };
    for (let ix = 0; ix < xs.length; ix++) for (let iy = 0; iy < ys.length; iy++) {
      const dx = xs[ix], dy = ys[iy];
      const still = dx === 0 && dy === 0;
      if (!still) {
        if (mustM.some(m => howAt(m, ix, iy) !== 1)) continue;
        if (o.ok && !o.ok(hx + dx, hy + dy)) continue;
        // past an end of the plan only where that takes nothing whole out of sight: it hides what is cut, it does not empty the room
        const past = cx + dx < fx[0] - 0.5 || cx + dx > fx[1] + 0.5 || cy + dy < fy[0] - 0.5 || cy + dy > fy[1] + 0.5;
        if (o.past && past && every.some(m => howAt(m, ix0, iy0) === 1 && howAt(m, ix, iy) === 0)) continue;
      }
      // the held step whole; or, to show what the press brings, its body at least
      const whole = still || !heldM || howAt(heldM, ix, iy) === 1;
      const seen = whole || (!!held?.body && bodyAt(heldM!, ix, iy) === 1);
      if (!seen) continue;
      let cost = o.per * (Math.abs(dx) + Math.abs(dy));
      // each fault costs; with `gain`, each thing whole in sight pays, so a move never empties the screen to cut nothing
      for (let j = 0; j < every.length; j++) {
        const m = every[j], c = m.cost[m.xc[ix] * m.ny + m.yc[iy]];
        cost += c === c ? c : costAt(m, ix, iy);
      }
      // what the press brings: one of it whole, where a move can show one
      const brings = freshM.some(m => howAt(m, ix, iy) === 1);
      if (whole && cost < bestCost) { bestCost = cost; best = [dx, dy]; }
      if (whole && brings && cost < wholeFreshCost) { wholeFreshCost = cost; bestWholeFresh = [dx, dy]; }
      if (!whole && brings && cost < freshCost) { freshCost = cost; bestFresh = [dx, dy]; }
    }
    return bestWholeFresh ?? bestFresh ?? best;
  }
  /** Tidies where the held step goes at a level, before the move there starts: the level is drawn at rest for a moment, out of sight, and put back. Each layout of a hold is tidied once. */
  function tidyAt(to: number, from: number): void {
    const h = ctx.anchor, L = ctx.views[ctx.view][to];
    if (!h || h.tidy.has(L)) return;
    // from where the step is now, which a tidy of the level it is at may have moved from where it was held; in both views, with the labels shown and hidden
    const now = ctx.here(h.id), Ms = ctx.setsBy.flatMap(S => S[ctx.flow].map(v => v[to])).filter(M => !!M);
    for (const M of Ms) {
      h.tidy.add(M);
      const [l, t] = ctx.rest(M, h.id, now, h.keep), g = M.geo.get(h.id)!;
      h.at.set(M, [l + g.x * M.s, t + g.y * M.s]);
    }
    const zWas = ctx.z;
    ctx.z = to;
    ctx.frame();
    // a level that fits the room is in the middle of it, as it is
    if (!ctx.laid.fits || h.keep) {
      const [rw, rh] = ctx.room();
      // what the level brings: a step, a group that is one step or a pill that is not drawn at the level before
      const fresh = new Set<string>();
      if (to > from) {
        const F = ctx.views[ctx.view][from];
        for (const [id, q] of L.geo) if (q.o > 0.5 && (F.geo.get(id)?.o ?? 0) < 0.5) fresh.add(`n:${id}`);
        for (const [k, q] of L.pods) if (q.o > 0.5 && (F.pods.get(k)?.o ?? 0) < 0.5) fresh.add(`p:${k}`);
        for (const [k, q] of L.pieces) {
          if (q.o < 0.5 || (F.pieces.get(k)?.o ?? 0) >= 0.5) continue;
          if (q.t === 'bar') fresh.add(`b:${q.of.key}`);
          else if (q.t === 'frame') fresh.add(`f:${k}`);
          else if (q.t === 'cap' || q.t === 'gname') fresh.add(`t:${k}`);
        }
      }
      tidyHeld(L, Ms, fresh, [Math.min(160, 0.35 * rw), Math.min(160, 0.35 * rh)]);
    }
    ctx.z = zWas;
    ctx.frame();
  }
  /** Tidies the place of the held step at a layout that is drawn at rest now, and moves it so in each layout of `Ms`.
   * Down, the column of the held step is whole in the room, where it fits: it moves in first, as little as it can, and stays whole. What an edge cuts is then of the columns beside it.
   * The held step goes no nearer the top or the bottom of the room than it was, or than 15% and 80%. */
  function tidyHeld(L: Layout, Ms: Layout[], fresh: Set<string>, reach: [number, number], gain = 1): void {
    const h = ctx.anchor;
    if (!h) return;
    const [rw, rh] = ctx.room();
    const shift = (dx: number, dy: number): void => {
      for (const M of Ms) {
        const p = h.at.get(M);
        if (p) h.at.set(M, [p[0] + dx, p[1] + dy]);
      }
    };
    let c = ctx.byId.get(h.id)?.owner;
    while (c?.parent && isTrack(c)) c = c.parent;
    const col = L.turned && c?.parent ? ctx.columnOf(c) : null, gx = L.geo.get(h.id)!.x;
    const fits = !!col && (col[1] - col[0]) * L.s <= rw;
    if (col && fits) {
      const hx = ctx.here(h.id)[0], l = hx + (col[0] - gx) * L.s, r = hx + (col[1] - gx) * L.s, ax = ctx.ends(L, h.keep)[0], cx = hx - gx * L.s;
      const dx = clamp(l < 0 ? -l : r > rw ? rw - r : 0, ax[0] - cx, ax[1] - cx);
      if (dx) {
        shift(dx, 0);
        ctx.frame();
      }
    }
    const inRoom = (hx: number): boolean => !col || !fits || (hx + (col[0] - gx) * L.s >= -0.5 && hx + (col[1] - gx) * L.s <= rw + 0.5);
    const y0 = ctx.here(h.id)[1], lo = Math.min(y0, 0.15 * rh), hi = Math.max(y0, 0.8 * rh);
    const [dx, dy] = tidyPlace(L, h.id, { reach, per: 0.05, gain, keep: h.keep, fresh, ok: (x, y) => y >= lo && y <= hi && inRoom(x) });
    if (dx || dy) shift(dx, dy);
  }

  return { tidyPlace, tidyAt, tidyHeld };
}

export type TidyPart = ReturnType<typeof tidyPart>;
