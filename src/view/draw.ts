// The drawing of a plan: every piece and every step, made once on each good show(), then moved by frame() (frame.ts).
// Also what stands for a thing on the plan right now: the thing, the pill of the closed track it is in, or far out the step of its group.
import { STATES, STATE_NAME, type State } from '../roadmap/types.js';
import type { ViewContext } from './context.js';
import { HELD, html } from './dom.js';
import { AURA, C, COIN, F, IC, PILL, layouts, pillW, tallyW } from './layout.js';
import { drawMark } from './mark.js';
import { r2 } from './math.js';
import { count, isTrack, levelName, sum, tally, tracksOf, type Plan, type TBranch, type TNode, type TSplit } from './plan.js';
import { SVG_NS, el } from './svg.js';

export interface NodeEls {
  g: SVGElement;
  /** The clear disc around it that takes a finger where the labels are hidden: of no size where they show, or where it is a coin. */
  tap: SVGElement;
  /** The ring that shows it is pointed at or picked. It also takes the pointer all around the step. */
  aura: SVGElement;
  /** Its name across, over it; and down, right of it. Only those of the layout the plan is in show. */
  lines: SVGElement[];
  vlines: SVGElement[];
  /** The mark of its state. */
  mark: SVGElement;
  /** Its icon, if it has one, and the body it lies on where the step is a coin. */
  icon?: SVGElement;
  coin?: SVGElement;
  /** Of a milestone: its ring. */
  ring?: SVGElement;
  /** Of a step that just changed: the gold ring that spreads from it. */
  halo?: SVGElement;
}

// A group as one step: a step like the others, with the mark of the state of all that is in it.
// With icons it is a coin, and the drawing on it says what it holds: lines that part for tracks side by side, steps on a line for steps in a row. It never says how many.
export interface PodEls {
  g: SVGElement;
  tap: SVGElement;
  coin: SVGElement;
  aura: SVGElement;
  icon: SVGElement;
  mark: SVGElement;
  lines: SVGElement[];
  vlines: SVGElement[];
  halo?: SVGElement;
}

/** The mark of a state, the one in the key: it is drawn once around (0, 0), then moved and sized. */
function markOf(parent: Element, s: State): SVGElement {
  const mark = el(parent, 'g', { class: 'st' }), ring0 = drawMark(s), half = Number(ring0.getAttribute('width')) / 2;
  ring0.setAttribute('x', String(-half)); ring0.setAttribute('y', String(-half));
  mark.append(ring0);
  return mark;
}

/** Is it drawn now: there, and not put out of sight by frame()? */
export const drawn = (c: Element | undefined): c is SVGElement => !!c && (c as SVGElement).style.display !== 'none';

export function drawPart(ctx: ViewContext) {
  const { head, hide, ICON_BOX, keyList, layers, stops, svg } = ctx;

  /** The pills of the tracks around a branch (see tracksOf()). Only that of a closed track shows. */
  const pills = (b?: TBranch): SVGElement[] => tracksOf(b).flatMap(t => ['bar', 'tally'].map(name => ctx.pieceEls.get(`${t.key}:${name}`)).filter(e => !!e));

  /** Draws a plan: the head, the stops of the zoom control, and every piece and every step, made once, then moved by frame().
   * Steps whose id is in `fresh` get the "just changed" look; it goes on from where it was, by how long ago each changed, so a redraw never plays it twice. */
  function draw(p: Plan, fresh: ReadonlyMap<string, number>): void {
    const since = (e: SVGElement | undefined, ms: number): void => {
      if (e && ms > 0) e.style.animationDelay = `${-Math.round(ms)}ms`;
    };
    // what stands for many steps has the look of the one that changed last
    const newest = (nodes: TNode[]): number | undefined => {
      const ages = nodes.flatMap(n => fresh.get(n.node.id) ?? []);
      return ages.length ? Math.min(...ages) : undefined;
    };
    ctx.plan = p;
    ({ all: ctx.all, K: ctx.K, hasIcons: ctx.hasIcons, byId: ctx.byId, byKey: ctx.byKey, byPod: ctx.byPod, pods: ctx.pods } = p);
    ctx.setsBy = [layouts(p), layouts(p, true)];
    ctx.sets = ctx.setsBy[ctx.labW()];
    ctx.views = ctx.sets[ctx.flow];
    ctx.turnLines = null;
    ctx.cur.clear();
    const roadmap = p.roadmap;

    // the key, in the popup: only the states the plan uses, and the milestone where it has one
    const key: HTMLLIElement[] = [];
    const used = new Set(ctx.all.map(n => n.state));
    for (const s of STATES.filter(st => used.has(st))) {
      const li = document.createElement('li');
      li.append(drawMark(s), STATE_NAME[s]);
      key.push(li);
    }
    if (ctx.all.some(n => n.milestone)) {
      // a milestone in the key: the ring of a step with the milestone's ring around it
      const li = document.createElement('li'), mark = document.createElementNS(SVG_NS, 'svg');
      mark.setAttribute('class', 'mark');
      mark.setAttribute('viewBox', '-12 -12 24 24');
      mark.setAttribute('width', '24'); mark.setAttribute('height', '24');
      mark.setAttribute('aria-hidden', 'true');
      el(mark, 'circle', { class: 'ms', r: F.RING });
      el(el(mark, 'g', { class: 'node todo' }), 'circle', { class: 'ring', r: C.R });
      li.append(mark, 'Milestone');
      key.push(li);
    }
    keyList.replaceChildren(...key);
    // the head: the roadmap's name, and how far the branches that show are
    head.replaceChildren(html('h1', 'title', roadmap.title), html('span', 'progress', `${ctx.all.filter(n => n.state === 'done').length} of ${ctx.all.filter(n => n.state !== 'canceled').length} steps done`));
    // the list of top-level branches, where there are two or more
    layers.hidden = p.every.length < 2;
    if (layers.hidden) ctx.setBranches(false);
    ctx.fillBranches();
    svg.setAttribute('aria-label', `${roadmap.title}: the roadmap as a tree`);

    // the stops are made again only when the plan needs others, so the keyboard focus stays on them
    if (ctx.stopEls.length !== ctx.K + 1) {
      ctx.stopEls.forEach(b => b.remove());
      ctx.stopEls = ctx.views[0].map((_, k) => {
        const b = html('button', 'stop', levelName(ctx.K, k));
        b.addEventListener('click', e => { if (e.timeStamp >= ctx.noClick) ctx.go(k); });
        stops.append(b);
        return b;
      });
    }
    // a plan that names no icon has no switch: the row holds only the pair of layouts
    hide.hidden = !ctx.hasIcons;
    ctx.placePopup();

    svg.replaceChildren();
    const gFrames = el(svg, 'g'), gBars = el(svg, 'g'), gHits = el(svg, 'g'), gLines = el(svg, 'g'), gNodes = el(svg, 'g'), gText = el(svg, 'g');
    ctx.pieceEls = new Map(); ctx.hitEls = new Map(); ctx.haloEls = new Map();
    for (const [k, p] of ctx.views[0][ctx.K].pieces) {
      const b = p.of;
      if (p.t === 'bar') {
        ctx.pieceEls.set(k, el(gBars, 'rect', { class: 'zbar', 'data-bar': b.key }));
      } else if (p.t === 'tally') {
        // drawn once around the middle of the pill, then moved and sized: the mark of the state of the track, and its count in the room after it.
        // frame() puts the mark, which is in the middle of a pill with no count, and shows the count where the names are written.
        const g = el(gNodes, 'g', { class: 'tally', 'data-bar': b.key }), w = pillW(b), r = C.R * PILL.MARK;
        markOf(g, sum(b));
        el(g, 'text', { x: r2(PILL.IN + 2 * r + PILL.GAP + tallyW(b) / 2 - w / 2), y: 4 }, tally(b));
        ctx.pieceEls.set(k, g);
      } else if (p.t === 'cap') ctx.pieceEls.set(k, el(gText, 'text', { class: 'cap', 'data-bar': b.key }, b.cap));
      else if (p.t === 'txt') ctx.pieceEls.set(k, el(gText, 'text', { class: 'count', 'data-bar': b.key }, count(b)));
      else if (p.t === 'frame') ctx.pieceEls.set(k, el(gFrames, 'rect', { class: 'group' }));
      // the name of an open group answers the pointer for the group, where the group is one that can be picked
      else if (p.t === 'gname') ctx.pieceEls.set(k, el(gText, 'text', { class: 'gname', ...(ctx.byPod.has(p.sp!.key) ? { 'data-pod': p.sp!.key } : {}) }, p.sp!.gname));
      else {
        ctx.pieceEls.set(k, el(gLines, 'path', { class: 'lane' }));
        ctx.hitEls.set(k, el(gHits, 'path', { class: 'hit', 'data-bar': b.key }));
      }
    }

    ctx.nodeEls = new Map();
    for (const n of ctx.all) {
      const age = fresh.get(n.node.id) ?? 0, isNew = fresh.has(n.node.id);
      const g = el(gNodes, 'g', { class: 'zn', 'data-id': n.node.id });
      // a step that just changed: a gold ring spreads from it, and all of it pops in
      const halo = isNew ? el(g, 'circle', { class: 'halo', r: C.R }) : undefined;
      const body = isNew ? el(g, 'g', { class: 'pop' }) : g;
      if (isNew) g.classList.add('fresh');
      since(halo, age);
      if (isNew) since(body, age);
      // under all else, the disc a finger hits; then the body of the coin, so the ring that lights is drawn on its edge
      const tap = el(body, 'circle', { class: 'tap', r: 0 });
      const coin = n.icon ? el(body, 'circle', { class: 'coin', r: n.milestone ? COIN.BIG : COIN.R }) : undefined;
      const aura = el(body, 'circle', { class: 'aura', r: C.R + AURA });
      const ring = n.milestone ? el(body, 'circle', { class: 'ms', r: F.RING }) : undefined;
      // the icon is drawn once around (0, 0) and shows only in the view with icons
      // a clear disc behind it takes the pointer between the lines of the drawing
      let icon: SVGElement | undefined;
      if (n.icon) {
        icon = el(body, 'g', { class: `ic ${n.state}` });
        el(icon, 'circle', { class: 'back', r: IC.BACK, opacity: 0 });
        el(icon, 'g', { class: 'art', transform: `translate(${-IC.SIZE / 2} ${-IC.SIZE / 2}) scale(${IC.SIZE / ICON_BOX})` }).innerHTML = n.icon;
      }
      // a step is the mark of its state at every level
      const mark = markOf(body, n.state);
      const cls = `label ${n.state}${n.milestone ? ' milestone' : ''}${isNew ? ' fresh' : ''}`;
      const lines = n.lines.map(t => el(gText, 'text', { class: cls, 'data-id': n.node.id }, t));
      // down, the name is wrapped to the room of the column it is in, and starts right of the step
      const vlines = n.vlines.map(t => el(gText, 'text', { class: `${cls} down`, 'data-id': n.node.id }, t));
      if (isNew) [...lines, ...vlines].forEach(l => since(l, age));
      ctx.nodeEls.set(n.node.id, { g, tap, aura, lines, vlines, mark, icon, coin, ring, halo });
    }

    ctx.podEls = new Map();
    for (const sp of ctx.pods) {
      const state = sum(sp), g = el(gNodes, 'g', { class: 'zn', 'data-pod': sp.key });
      // far out, a group that holds a step that just changed gets the gold ring of that step
      const age = newest(sp.nodes), halo = age !== undefined ? el(g, 'circle', { class: 'halo' }) : undefined;
      since(halo, age ?? 0);
      const tap = el(g, 'circle', { class: 'tap', r: 0 }), coin = el(g, 'circle', { class: 'coin' }), aura = el(g, 'circle', { class: 'aura' });
      const icon = el(g, 'g', { class: `ic ${state}` });
      el(icon, 'g', { class: 'art', transform: `translate(${-IC.SIZE / 2} ${-IC.SIZE / 2}) scale(${IC.SIZE / 24})` }).innerHTML = sp.kids.length > 1 ? HELD.tracks : HELD.row;
      const mark = markOf(g, state);
      const lines = sp.lines.map(t => el(gText, 'text', { class: `label ${state}`, 'data-pod': sp.key }, t));
      const vlines = sp.vlines.map(t => el(gText, 'text', { class: `label ${state} down`, 'data-pod': sp.key }, t));
      ctx.podEls.set(sp.key, { g, tap, coin, aura, icon, mark, lines, vlines, halo });
    }
    // a closed track that holds a step that just changed: the gold ring goes around its pill
    for (const n of ctx.all) if (fresh.has(n.node.id)) {
      for (let b: TBranch | undefined = n.owner; b; b = b.parent) {
        const k = `${b.key}:bar`;
        if (!isTrack(b) || !ctx.pieceEls.has(k) || ctx.haloEls.has(k)) continue;
        const halo = el(gBars, 'rect', { class: 'halo pill' });
        since(halo, newest(b.nodes)!);
        ctx.haloEls.set(k, halo);
      }
    }

    ctx.partsOf = new Map();
    for (const n of ctx.all) {
      const e = ctx.nodeEls.get(n.node.id)!;
      // both of its names: the one of the layout the plan is not in is not drawn, so it never shows what lights
      ctx.partsOf.set(n, [e.g, ...e.lines, ...e.vlines]);
    }
    for (const [k, p] of ctx.views[0][ctx.K].pieces) {
      // the frame of a group and its name are kept with its first track, and are not a part of that track
      for (let b: TBranch | undefined = p.sp ? p.of.parent : p.of; b; b = b.parent) ctx.partsOf.set(b, [...(ctx.partsOf.get(b) ?? []), ctx.pieceEls.get(k)!]);
    }
    // A step or a branch inside a closed track is not drawn: the pill of that track stands for it, and lights when it is picked in the side bar.
    for (const n of ctx.all) ctx.partsOf.set(n, [...ctx.partsOf.get(n)!, ...pills(n.owner)]);
    for (const b of ctx.byKey.values()) ctx.partsOf.set(b, [...(ctx.partsOf.get(b) ?? []), ...pills(b.parent)]);
    // A group that is one step: its body and its name. It stands for all that is in it, and all that is in it stands for it:
    // closer in, a picked group lights its tracks; far out, a step or a track that is picked in the side bar lights the group it is in.
    for (const sp of ctx.pods) {
      const e = ctx.podEls.get(sp.key)!, own = [e.g, ...e.lines, ...e.vlines];
      const open = ['frame', 'gname'].map(n => ctx.pieceEls.get(`${sp.kids[0].key}:${n}`)).filter(x => !!x);
      ctx.partsOf.set(sp, [...own, ...open, ...sp.kids.flatMap(c => ctx.partsOf.get(c)!)]);
      for (const t of [...sp.nodes, ...[...ctx.byKey.values()].filter(b => b.pod === sp)]) ctx.partsOf.set(t, [...ctx.partsOf.get(t)!, ...own]);
    }
  }
  /** The pill of a track that is closed right now. */
  const shut = (b: TBranch): SVGElement | undefined => {
    const held = ctx.pieceEls.get(`${b.key}:tally`);
    return held && held.style.display !== 'none' ? ctx.pieceEls.get(`${b.key}:bar`) : undefined;
  };

  /** What stands for a step on the plan right now: the step, or else the pill of the closed track it is in, or far out the step that stands for its group. */
  const stands = (b?: TBranch, pod?: TSplit): (SVGElement | undefined)[] => [...pills(b), pod && ctx.podEls.get(pod.key)!.g];
  /** What stands for a step on the plan now: the step, or the pill of the closed track it is in, or far out the step of its group. */
  const standFor = (n: TNode): SVGElement | undefined => [ctx.nodeEls.get(n.node.id)!.g, ...stands(n.owner, n.owner.pod)].find(drawn);

  return { pills, draw, shut, stands, standFor };
}

export type DrawPart = ReturnType<typeof drawPart>;
