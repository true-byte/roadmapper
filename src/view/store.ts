// What the view keeps in localStorage under options.store, and the start: the page as it was left, with each thing that the plan and the page still have.
// A thing they no longer have, such as a step gone from the file, starts as the first visit has it; the rest comes back.
import type { ViewContext } from './context.js';
import type { Mode } from './dom.js';
import { MAG } from './frame.js';
import { clamp } from './math.js';
import type { Past } from './place.js';
import { isStep } from './plan.js';
import { refOf, type Ref } from './side.js';

/** What a page kept. Each part but the level may be missing, as in what an older page kept: it then starts as the first visit has it. */
export interface Kept {
  level: number;
  /** Is the level the last one, 'Every step'? The file may have more levels by the next visit. */
  last?: boolean;
  /** Are the icons shown? */
  icons?: boolean;
  /** Are the labels shown? */
  labels?: boolean;
  /** The layout the user picked: across or down; null where the user picked none, and the layout follows the size of the view. */
  flow?: 'h' | 'v' | null;
  /** The scale, against reading size. */
  scale?: number;
  /** The top-level branches the user showed or hid against what they get by default, by their tags. */
  branches?: Record<string, boolean>;
  /** Is the zoom control hidden down to its grip? */
  tucked?: boolean;
  /** Is the 'Links' part of the side bar open? */
  links?: boolean;
  /** Is 'Include private items' on? */
  private?: boolean;
  /** The mode the user picked: light, dark, or as the device is set. */
  mode?: Mode;
  /** How far past its ends the first view put the plan (see beyond). */
  past?: Partial<Past>;
  /** The step nearest the middle of the stage, and where it was on the stage, as parts of its width and its height. */
  id?: string;
  fx?: number;
  fy?: number;
  /** The picked step, group or branch, by what the side bar calls it; null where nothing is picked and the side bar is closed. */
  pick?: Ref | null;
  /** What the side bar showed before, the last one last: the back arrow shows the last. */
  back?: Ref[];
  /** How far down the side bar is scrolled, in px. */
  sideTop?: number;
  /** Is the popup of the tools button open? */
  popup?: boolean;
  /** Each part of the popup open or closed, by its name: 'Key', 'View' and 'Export'. */
  parts?: Record<string, boolean>;
  /** Is the list of branches open? */
  list?: boolean;
  /** The blocked step that 'Show only blockers' shows with its blockers alone, by its id; null while all of the plan shows. */
  only?: string | null;
}

const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const text = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const flags = (v: unknown): Record<string, boolean> | undefined =>
  isObject(v) ? Object.fromEntries(Object.entries(v).filter((e): e is [string, boolean] => typeof e[1] === 'boolean')) : undefined;
const pair = (v: unknown): [number, number] | undefined => (Array.isArray(v) && v.length === 2 && v.every(x => num(x) !== undefined) ? [v[0], v[1]] : undefined);
/** Is it what the side bar calls a thing? */
const isRef = (v: unknown): v is Ref =>
  isObject(v) && ['step', 'branch', 'group'].includes(v.kind as string) && typeof v.key === 'string' && (v.name === undefined || typeof v.name === 'string')
  && Array.isArray(v.ids) && v.ids.every(id => typeof id === 'string');

/** What a page kept, from the text it kept. A part of the wrong kind is left out, as if it were not kept. Null where the text is not JSON or keeps no level. */
export function readKept(saved: string | null): Kept | null {
  let k: unknown;
  try {
    k = JSON.parse(saved ?? 'null');
  } catch {
    return null;
  }
  if (!isObject(k) || !Number.isInteger(k.level)) return null;
  const p = isObject(k.past) ? k.past : undefined;
  return {
    level: k.level as number,
    last: bool(k.last), icons: bool(k.icons), labels: bool(k.labels),
    flow: k.flow === 'h' || k.flow === 'v' || k.flow === null ? k.flow : undefined,
    scale: num(k.scale), branches: flags(k.branches), tucked: bool(k.tucked), links: bool(k.links), private: bool(k.private),
    mode: k.mode === 'device' || k.mode === 'light' || k.mode === 'dark' ? k.mode : undefined,
    past: p && { near: pair(p.near), far: pair(p.far) },
    id: text(k.id), fx: num(k.fx), fy: num(k.fy),
    pick: k.pick === null ? null : isRef(k.pick) ? k.pick : undefined,
    back: Array.isArray(k.back) ? k.back.filter(isRef) : undefined,
    sideTop: num(k.sideTop),
    popup: bool(k.popup), parts: flags(k.parts), list: bool(k.list),
    only: k.only === null ? null : text(k.only),
  };
}

/** The place of the plan, as the view keeps it. */
export type KeptPlace = Pick<Kept, 'scale' | 'id' | 'fx' | 'fy' | 'past'>;

export function storePart(ctx: ViewContext) {
  const { fit, frozen, frozenT, frozenU, frozenW, layers, once, options, PAD, parts, picker, popup, side, stage, still } = ctx;

  /** The place of the plan now: the step nearest the middle of the stage, where it is on the stage, the scale, and how far past its ends the first view put the plan. */
  function placeNow(): KeptPlace {
    const r = stage.getBoundingClientRect(), n = ctx.nearest(ctx.all, r.left + r.width / 2, r.top + r.height / 2), [x, y] = ctx.at(n.node.id);
    return { scale: Math.round(ctx.mag * 1000) / 1000, id: n.node.id, fx: (x - r.left) / r.width, fy: (y - r.top) / r.height, past: { near: [...ctx.beyond.near], far: [...ctx.beyond.far] } };
  }
  /** While the page is put back as it was left: what is kept then is only partly back, and is not written. */
  let starting = false;
  function save(): void {
    // a plan with no step has no place to keep
    if (still || !options.store || !ctx.all.length || starting) return;
    // while only a blocked step and its blockers show, the place kept is the one before
    const kept: Kept = {
      level: ctx.asked, last: ctx.askedLast, icons: ctx.prefer, labels: ctx.labels, flow: ctx.pickFlow, ...(ctx.only?.place ?? placeNow()), branches: Object.fromEntries(ctx.choices),
      tucked: ctx.tucked, links: ctx.linksOpen, private: ctx.withPrivate, mode: ctx.mode,
      pick: ctx.picked ? refOf(ctx.picked) : null, back: ctx.picked ? ctx.past : [], sideTop: ctx.picked ? Math.round(ctx.sideAsked ?? side.scrollTop) : 0,
      popup: !popup.hidden, parts: Object.fromEntries(parts.map(p => [p.name, p.isOpen()])), list: !picker.hidden, only: ctx.only?.n.node.id ?? null,
    };
    try {
      localStorage.setItem(options.store, JSON.stringify(kept));
    } catch {
      // no storage: nothing is kept
    }
  }
  window.addEventListener('pagehide', save, once);
  function kept(): Kept | null {
    if (!options.store) return null;
    try {
      return readKept(localStorage.getItem(options.store));
    } catch {
      return null;
    }
  }
  function start(): void {
    const was = still ? null : kept();
    starting = true;
    ctx.z = ctx.target = frozen !== null ? clamp(frozen, 0, ctx.K) : was?.last === true ? ctx.K : clamp(was?.level ?? 0, 0, ctx.K);
    if (frozen !== null) ctx.target = Math.round(ctx.z);
    ctx.asked = frozen === null && was ? was.level : ctx.target;
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
    ctx.pickFlow = frozenT === null ? was?.flow ?? null : null;
    ctx.t = frozenT !== null ? clamp(frozenT, 0, 1) : (ctx.pickFlow ?? fit.flow) === 'v' ? 1 : 0;
    ctx.flow = Math.round(ctx.t) === 1 ? 'v' : 'h';
    ctx.views = ctx.sets[ctx.flow];
    ctx.mag = was?.scale !== undefined ? clamp(was.scale, MAG.LO, MAG.HI) : 1;
    ctx.setTucked(was?.tucked === true);
    ctx.linksOpen = was?.links !== false;
    ctx.withPrivate = was?.private === true;
    // each part of the popup that this page has, open unless it was left closed
    for (const p of parts) p.setOpen(was?.parts?.[p.name] !== false);
    ctx.size();
    ctx.frame();
    ctx.controls();
    // the pick comes back before the place, with its side bar and the way back: with the side bar open, the place can lie as far past the end of the plan as the side bar covers
    const pick = was?.pick ? ctx.thingOf(was.pick) : undefined;
    if (pick) {
      ctx.past = (was?.back ?? []).filter(r => !!ctx.thingOf(r));
      ctx.pick(pick, false, true);
    }
    // the level and the scale come back even when the step is gone from the plan; the place comes back only with the step
    const back = was?.id !== undefined ? ctx.byId.get(was.id) : undefined;
    if (was?.fx !== undefined && was.fy !== undefined && back) {
      const r = stage.getBoundingClientRect(), p: [number, number] = [was.fx * r.width - PAD.l, was.fy * r.height - PAD.t];
      // a place past the end of the plan comes back as it was, as far past it as the first view put the plan, and no further: a place kept at another size,
      // or with a side bar that is now closed, comes back to the end
      const L = ctx.views[ctx.view][ctx.target], g = L.geo.get(back.node.id)!, out = ctx.pastEnd(L, [p[0] - g.x * L.s, p[1] - g.y * L.s]), most = ctx.firstReach(L);
      const cap = (a: [number, number], k: [number, number] | undefined): [number, number] => [0, 1].map(i => Math.min(a[i], most[i], k ? Math.max(0, k[i]) : 0)) as [number, number];
      ctx.beyond = { near: cap(out.near, was.past?.near), far: cap(out.far, was.past?.far) };
      ctx.anchor = ctx.hold(back, p, true);
      ctx.frame();
      ctx.anchor = null;
    } else {
      ctx.firstView();
      // the picked thing, in sight clear of the side bar
      if (pick) ctx.uncover(true);
    }
    // on a phone, the sheet of a pick that came back closes with the plan where it is: where the plan was before the sheet opened is not kept
    ctx.sheetFrom = null;
    if (pick) side.scrollTop = ctx.sideAsked = was?.sideTop ?? 0;
    starting = false;
    // 'Show only blockers' of the picked step, where it still has blockers on the plan
    if (pick && isStep(pick) && was?.only === pick.node.id) ctx.showOnly(pick);
    // the popup or the list of branches; where the side bar is a sheet at the bottom, neither shows with it
    if (!ctx.tucked && !(fit.bottom && ctx.picked)) {
      if (was?.popup) ctx.setPopup(true);
      else if (was?.list && !layers.hidden) ctx.setBranches(true, false, true);
    }
  }

  return { save, kept, start, placeNow };
}

export type StorePart = ReturnType<typeof storePart>;
