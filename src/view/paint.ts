// A show(): a good text is drawn again, at the same level, in the same view, at the same place, with the same pick; a broken one shows the error list.
// A step whose state changed has the "just changed" look for a moment.
import { checkRoadmap } from '../roadmap/check.js';
import type { FileError } from '../roadmap/errors.js';
import { nodeStates } from '../roadmap/states.js';
import type { State } from '../roadmap/types.js';
import type { ViewContext } from './context.js';
import { drawn } from './draw.js';
import { look } from './fonts.js';
import { clamp } from './math.js';
import { readPlan, type TNode } from './plan.js';
import { refOf, type Ref } from './side.js';

// how long a changed step keeps its "just changed" look
const FRESH_MS = 3000;

export function paintPart(ctx: ViewContext) {
  const { art, errorList, host, layers, names, options, showAll, side, stage, still } = ctx;

  // the state of each step before this draw; null until the first draw, so nothing counts as changed on load
  let known: Map<string, State> | null = null;
  // steps changed a moment ago, and when their "just changed" look ends; a second save must not wipe it
  const freshUntil = new Map<string, number>();
  /** Each step loses its "just changed" look when its own time is up, and so does what stands for it once no step in it still has the look. */
  function tidyLater(): void {
    if (!freshUntil.size) return;
    ctx.tidy = window.setTimeout(() => {
      const now = Date.now();
      for (const [id, end] of freshUntil) if (end <= now) freshUntil.delete(id);
      const still = (nodes: TNode[]): boolean => nodes.some(n => freshUntil.has(n.node.id));
      for (const n of ctx.all) {
        const e = ctx.nodeEls.get(n.node.id)!;
        if (freshUntil.has(n.node.id) || !e.g.classList.contains('fresh')) continue;
        e.g.classList.remove('fresh');
        [...e.lines, ...e.vlines].forEach(l => l.classList.remove('fresh'));
        e.halo?.remove(); e.halo = undefined;
      }
      for (const sp of ctx.pods) {
        const e = ctx.podEls.get(sp.key)!;
        if (e.halo && !still(sp.nodes)) { e.halo.remove(); e.halo = undefined; }
      }
      for (const [k, halo] of ctx.haloEls) {
        if (still(ctx.byKey.get(k.slice(0, -':bar'.length))!.nodes)) continue;
        halo.remove();
        ctx.haloEls.delete(k);
      }
      tidyLater();
    }, Math.max(0, Math.min(...freshUntil.values()) - Date.now()));
  }
  function fail(error: FileError, file?: string): void {
    ctx.list([error], file);
  }
  function show(source: string, file?: string): void {
    const { roadmap, errors } = checkRoadmap(source);
    if (!roadmap) {
      // the title of the roadmap, unless the text is not JSON
      let title: unknown;
      if (errors[0].error !== 'Invalid JSON') title = (JSON.parse(source) as { title?: unknown } | null)?.title;
      ctx.list(errors, file, typeof title === 'string' ? title : undefined);
      return;
    }
    // the plan comes back in place of the list
    errorList.hidden = true;
    errorList.replaceChildren();
    host.classList.remove('broken');
    paint(source);
  }
  /** Draws a good text: a new one, or the last good one again, as for a branch shown or hidden, which leaves a list of errors where it is. */
  function paint(source: string): void {
    ctx.stageSize = null;
    const roadmap = checkRoadmap(source).roadmap!;
    const states = nodeStates(roadmap);
    const before = known, now = Date.now();
    // a step that is new, or whose state is not what it was
    const changed = before ? [...states.keys()].filter(id => before.get(id) !== states.get(id)) : [];
    for (const id of changed) freshUntil.set(id, now + FRESH_MS);
    for (const [id, end] of freshUntil) if (end <= now || !states.has(id)) freshUntil.delete(id);
    const fonts = ctx.measure();
    ctx.measured = look(fonts);
    // the branches the user showed or hid the last time, before the first plan is read
    if (!ctx.plan && !still) ctx.choices = new Map(Object.entries(ctx.kept()?.branches ?? {}));
    const next = readPlan(roadmap, art, fonts, (tag, over) => ctx.choices.get(tag) ?? !over);
    // 'Saved', or an export that could not be made, was about the text before
    if (source !== ctx.shown) ctx.resetExport();
    // a redraw of the same text, as when a web font loads, keeps 'Show only blockers', at the scale it has, with the place that 'Show all' brings back
    const stays = ctx.only && source === ctx.shown ? { id: ctx.only.n.node.id, before: { was: ctx.only.was, place: ctx.only.place } } : null;
    ctx.shown = source;

    const first = !ctx.plan;
    // what the redraw keeps: the step nearest the middle that is still in the plan, and where it is on the screen; and what is picked
    let keep: TNode | undefined, keepAt: [number, number] | undefined, keepPick: Ref | null = null, sideTop = 0;
    // and the level: 'Every step' stays the last level when a group inside a group adds one before it.
    // A page held still by its address, between two levels, between the two views, between the two layouts or between the labels shown and hidden, stays held.
    let midZ: number | null = null, midU: number | null = null, midT: number | null = null, midW: number | null = null;
    const fresh = !first && !ctx.toggling && ctx.untouched();
    if (!first) {
      // what is on its way ends at once, and a page that shows only some steps shows all again, at the scale it had, unless the same text is drawn again
      ctx.endScale();
      if (ctx.only) {
        if (!stays) {
          ctx.mag = ctx.only.was.mag;
          ctx.floor = null;
        }
        ctx.only = null;
        host.classList.remove('only');
        showAll.hidden = names.hidden = true;
        names.replaceChildren();
        ctx.size();
        ctx.frame();
      }
      if (ctx.raf) { cancelAnimationFrame(ctx.raf); ctx.raf = 0; ctx.z = ctx.target; ctx.u = ctx.view; ctx.t = ctx.flowT(); ctx.w = ctx.labW(); ctx.frame(); }
      if (ctx.z !== ctx.target) midZ = ctx.z;
      if (ctx.u !== ctx.view) midU = ctx.u;
      if (ctx.t !== ctx.flowT()) midT = ctx.t;
      if (ctx.w !== ctx.labW()) midW = ctx.w;
      const r = stage.getBoundingClientRect(), mx = r.left + r.width / 2, my = r.top + r.height / 2;
      const away = (n: TNode): number => { const [x, y] = ctx.at(n.node.id); return Math.hypot(x - mx, y - my); };
      keep = ctx.all.filter(n => next.byId.has(n.node.id)).sort((a, b) => away(a) - away(b))[0];
      if (keep) keepAt = ctx.here(keep.node.id);
      if (ctx.picked) { keepPick = refOf(ctx.picked); sideTop = side.scrollTop; }
      ctx.hover(null);
      ctx.picked = null; ctx.rowHot = null;
      ctx.anchor = null;
      ctx.been = null;
      ctx.sheetFrom = null;
    }

    // each step that changed a moment ago, and how long ago
    ctx.draw(next, new Map([...freshUntil].map(([id, end]) => [id, FRESH_MS - (end - now)])));
    if (first) ctx.start();
    else {
      ctx.target = ctx.askedLast ? ctx.K : clamp(ctx.asked, 0, ctx.K); ctx.z = ctx.target;
      if (midZ !== null) { ctx.z = clamp(midZ, 0, ctx.K); ctx.target = Math.round(ctx.z); }
      ctx.view = ctx.hasIcons && ctx.prefer ? 1 : 0; ctx.u = ctx.view;
      if (midU !== null && ctx.hasIcons) ctx.u = midU;
      ctx.t = midT ?? ctx.flowT();
      ctx.w = midW ?? ctx.labW();
      ctx.size();
      ctx.frame();
      ctx.controls();
      // a held page is drawn as its address draws it on a load
      const back = keep && midZ === null && midU === null && midT === null && midW === null && ctx.byId.get(keep.node.id);
      if (fresh) ctx.firstView();
      else if (back && keepAt) {
        ctx.anchor = ctx.hold(back, keepAt, true);
        ctx.frame();
        ctx.anchor = null;
      }
    }

    // a plan of one top-level branch has no list of branches: the list closes once the plan is in place, as its close is kept
    if (layers.hidden) ctx.setBranches(false);
    // the pick stays when its step, branch or group is still in the plan, with what the plan says now; else the side bar closes
    const again = keepPick ? ctx.thingOf(keepPick) : undefined;
    if (again) {
      ctx.pick(again, false, true);
      side.scrollTop = ctx.sideAsked ?? sideTop;
    } else if (keepPick) {
      side.hidden = true;
      side.replaceChildren();
      ctx.past = [];
      ctx.uncover();
    }
    const only = stays && ctx.byId.get(stays.id);
    if (only) ctx.showOnly(only, stays.before);

    // the first thing that changed comes into sight: the step, or what stands for it at this level; the level stays
    const firstChanged = changed.map(id => ctx.byId.get(id)).find(n => !!n);
    if (firstChanged) {
      const e = [ctx.nodeEls.get(firstChanged.node.id)!.g, ...ctx.stands(firstChanged.owner, firstChanged.owner.pod)].find(drawn);
      if (e) ctx.sight(e);
    }
    window.clearTimeout(ctx.tidy);
    tidyLater();

    ctx.stageWas = [stage.offsetWidth, stage.offsetHeight];
    ctx.roomWas = ctx.room();
    known = states;
    // a move that was on its way has ended
    ctx.moving();
    options.onDraw?.(roadmap);
  }

  return { fail, show, paint };
}

export type PaintPart = ReturnType<typeof paintPart>;
