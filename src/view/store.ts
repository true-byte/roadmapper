// What the view keeps in localStorage under options.store, and the start: at the level, in the view and at the place the page was left at.
import type { ViewContext } from './context.js';
import { MAG } from './frame.js';
import { clamp } from './math.js';
import type { Past } from './place.js';

export interface Kept {
  level: number;
  /** Is the level the last one, 'Every step'? The file may have more levels by the next visit. Not there in what an older page kept. */
  last?: boolean;
  /** Not there in what an older page kept. */
  icons?: boolean;
  /** Are the labels shown? Not there in what an older page kept: that page opens with them shown. */
  labels?: boolean;
  /** The layout the user picked: across or down; null where the user picked none, and the layout follows the size of the view. Not there in what an older page kept. */
  flow?: 'h' | 'v' | null;
  /** The scale, against reading size. Not there in what an older page kept: that page opens at reading size. */
  scale?: number;
  /** The top-level branches the user showed or hid against what they get by default, by their tags. Not there in what an older page kept. */
  branches?: Record<string, unknown>;
  /** Is the zoom control hidden down to its grip? Not there in what an older page kept. */
  tucked?: boolean;
  /** Is the 'Links' part of the side bar open? Not there in what an older page kept: that page opens it. */
  links?: boolean;
  /** How far past its ends the first view put the plan (see beyond). Not there in what an older page kept. */
  past?: Past;
  id: string;
  fx: number;
  fy: number;
}

export function storePart(ctx: ViewContext) {
  const { fit, frozen, frozenT, frozenU, frozenW, once, options, PAD, stage, still } = ctx;

  function save(): void {
    // a plan with no step has no place to keep; nor has a page that shows only some steps for now
    if (still || !options.store || !ctx.all.length || ctx.only) return;
    const r = stage.getBoundingClientRect(), n = ctx.nearest(ctx.all, r.left + r.width / 2, r.top + r.height / 2), [x, y] = ctx.at(n.node.id);
    try {
      localStorage.setItem(options.store, JSON.stringify({ level: ctx.asked, last: ctx.askedLast, icons: ctx.prefer, labels: ctx.labels, flow: ctx.pickFlow, scale: Math.round(ctx.mag * 1000) / 1000, id: n.node.id, fx: (x - r.left) / r.width, fy: (y - r.top) / r.height, branches: Object.fromEntries(ctx.choices), tucked: ctx.tucked, links: ctx.linksOpen, past: ctx.beyond }));
    } catch {
      // no storage: the level, the view, the scale and the place are not kept
    }
  }
  window.addEventListener('pagehide', save, once);
  function kept(): Kept | null {
    if (!options.store) return null;
    try {
      const k = JSON.parse(localStorage.getItem(options.store) ?? 'null') as Kept | null;
      return k && Number.isInteger(k.level) ? k : null;
    } catch {
      return null;
    }
  }
  function start(): void {
    const was = still ? null : kept();
    ctx.z = ctx.target = frozen !== null ? clamp(frozen, 0, ctx.K) : was?.last === true ? ctx.K : clamp(was?.level ?? 0, 0, ctx.K);
    if (frozen !== null) ctx.target = Math.round(ctx.z);
    ctx.asked = frozen === null && Number.isInteger(was?.level) ? was!.level : ctx.target;
    ctx.askedLast = frozen === null && was?.last === true;
    // a plan with icons starts with them shown
    ctx.prefer = frozenU !== null ? Math.round(clamp(frozenU, 0, 1)) === 1 : was?.icons !== false;
    ctx.u = !ctx.hasIcons ? 0 : frozenU !== null ? clamp(frozenU, 0, 1) : ctx.prefer ? 1 : 0;
    ctx.view = Math.round(ctx.u);
    // the labels start shown, unless the user hid them
    ctx.labels = frozenW !== null ? Math.round(clamp(frozenW, 0, 1)) === 0 : was?.labels !== false;
    ctx.w = frozenW !== null ? clamp(frozenW, 0, 1) : ctx.labW();
    ctx.sets = ctx.setsBy[ctx.labW()];
    // the layout the user picked, or else the one the size of the view gives; the address can hold the page on its way from one to the other
    ctx.pickFlow = frozenT === null && (was?.flow === 'h' || was?.flow === 'v') ? was.flow : null;
    ctx.t = frozenT !== null ? clamp(frozenT, 0, 1) : (ctx.pickFlow ?? fit.flow) === 'v' ? 1 : 0;
    ctx.flow = Math.round(ctx.t) === 1 ? 'v' : 'h';
    ctx.views = ctx.sets[ctx.flow];
    ctx.mag = typeof was?.scale === 'number' && Number.isFinite(was.scale) ? clamp(was.scale, MAG.LO, MAG.HI) : 1;
    ctx.setTucked(was?.tucked === true);
    ctx.linksOpen = was?.links !== false;
    ctx.size();
    ctx.frame();
    ctx.controls();
    // the level and the scale come back even when the step is gone from the plan; the place comes back only with the step
    const back = was ? ctx.byId.get(was.id) : undefined;
    if (was && back && Number.isFinite(was.fx) && Number.isFinite(was.fy)) {
      const r = stage.getBoundingClientRect(), p: [number, number] = [was.fx * r.width - PAD.l, was.fy * r.height - PAD.t];
      // a place past the end of the plan comes back as it was, as far past it as the first view put the plan, and no further: a place kept at another size, or with the side bar open, comes back to the end
      const L = ctx.views[ctx.view][ctx.target], g = L.geo.get(back.node.id)!, out = ctx.pastEnd(L, [p[0] - g.x * L.s, p[1] - g.y * L.s]), most = ctx.firstReach(L);
      const cap = (a: [number, number], k: unknown): [number, number] =>
        [0, 1].map(i => Math.min(a[i], most[i], Array.isArray(k) && Number.isFinite(k[i]) ? Math.max(0, k[i]) : 0)) as [number, number];
      ctx.beyond = { near: cap(out.near, was.past?.near), far: cap(out.far, was.past?.far) };
      ctx.anchor = ctx.hold(back, p, true);
      ctx.frame();
      ctx.anchor = null;
    } else ctx.firstView();
  }

  return { save, kept, start };
}

export type StorePart = ReturnType<typeof storePart>;
