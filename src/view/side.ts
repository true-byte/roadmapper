// The side bar: a click picks a step, a group or a branch; it stays lit, and the side bar shows what the plan says about it. A click never zooms.
// What a thing is called across a redraw, so a pick and the way back outlive it.
import { ARROW, BRANCHES, LINKS } from '../icons/icons.js';
import type { Link } from '../roadmap/types.js';
import type { ViewContext } from './context.js';
import { html } from './dom.js';
import { drawn } from './draw.js';
import { facts } from './facts.js';
import { drawMark } from './mark.js';
import { clamp, union } from './math.js';
import { blockers, count, day, isBranch, isKids, isStep, sole, sum, type TBranch, type TSplit, type Thing } from './plan.js';

/** What a thing is called across a redraw: a step by its id; a branch or a group by its name and its steps, since its place in the plan moves when items are put before it. */
export interface Ref {
  kind: 'step' | 'branch' | 'group';
  /** The id of a step, or the place of a branch or a group. */
  key: string;
  name?: string;
  ids: string[];
}

export const refOf = (t: Thing): Ref =>
  isStep(t) ? { kind: 'step', key: t.node.id, ids: [] } : { kind: isBranch(t) ? 'branch' : 'group', key: t.key, name: t.name, ids: t.nodes.map(n => n.node.id) };

function part(name: string, ...body: (Node | string)[]): HTMLElement {
  const s = html('section', 'part');
  s.append(html('h3', '', name), ...body);
  return s;
}

// a click on a step or a branch picks it; a click on empty space lets go of it, or first brings all back. A drag is not a click.
// A tap of a finger does the same TAP.MS later, unless a second tap comes that near: that is a double tap, which goes one level in and picks nothing. A finger held past TAP.HOLD does nothing.
export const TAP = { MS: 300, PX: 30, HOLD: 500 };

export function sidePart(ctx: ViewContext) {
  const { art, fit, glyph, head, host, PAD, side, stage } = ctx;

  function thingOf(r: Ref): Thing | undefined {
    if (r.kind === 'step') return ctx.byId.get(r.key);
    const pool: (TBranch | TSplit)[] = [...(r.kind === 'branch' ? ctx.byKey : ctx.byPod).values()];
    // how alike its steps are to those it had: the steps both have, over the steps either has
    const like = (t: TBranch | TSplit): number => {
      const ids = new Set(t.nodes.map(n => n.node.id)), both = r.ids.filter(id => ids.has(id)).length;
      return both / Math.max(1, ids.size + r.ids.length - both);
    };
    const best = (from: (TBranch | TSplit)[]): { top?: TBranch | TSplit; most: number } => {
      let top: TBranch | TSplit | undefined, most = 0;
      for (const t of from) if (like(t) > most) { top = t; most = like(t); }
      return { top, most };
    };
    const same = pool.filter(t => t.name === r.name), any = best(pool);
    // the one of the same name with the most steps in common; or else, where it had no step to tell it by, the one of the same name at the same place;
    // or else, where it was renamed, the one with most of its steps
    return best(same).top ?? (r.ids.length ? undefined : same.find(t => t.key === r.key)) ?? (any.most >= 0.5 ? any.top : undefined);
  }
  /** A step, a group or a branch as one row to press: it picks that thing, and lights it on the plan while pointed at. */
  function row(t: Thing): HTMLElement {
    // a step in a hidden branch is not on the plan: its name, and a pill with the name of its top-level branch, and it answers no pointer.
    // A click shows neither name whole, so the browser's tip does while either is cut. Where nothing points without a touch, no tip shows, and the CSS cuts neither
    if (isStep(t) && t.hidden) {
      const r = html('div', 'row off'), pill = html('span', 'gone');
      let top = t.owner;
      while (top.parent) top = top.parent;
      const nm = html('span', t.milestone ? 'strong nm' : 'nm', t.node.name), branch = html('span', 'cut', top.name ?? 'Branch');
      pill.append(glyph(BRANCHES.hidden, 14, ''), branch);
      r.append(drawMark(t.state), nm, pill);
      cuts.observe(nm);
      cuts.observe(branch);
      return r;
    }
    const b = html('button', 'row');
    if (isStep(t)) b.append(drawMark(t.state), html('span', t.milestone ? 'strong nm' : 'nm', t.node.name));
    else if (isBranch(t)) b.append(html('span', 'branch nm', t.name ?? 'Branch'), html('span', 'dim', count(t)));
    else b.append(drawMark(sum(t)), html('span', 'nm', t.name), html('span', 'dim', count(t)));
    b.addEventListener('click', () => pick(t));
    b.addEventListener('pointerenter', e => { if (e.pointerType === 'touch') return; ctx.rowHot = t; ctx.light(t, 'hot', true); ctx.aim(t); });
    b.addEventListener('pointerleave', e => { if (e.pointerType === 'touch') return; ctx.rowHot = null; ctx.light(t, 'hot', t === ctx.hot); ctx.aim(null); });
    return b;
  }
  /** A row that a click does not show whole, a link or a step in a hidden branch, has its whole text in the browser's own tip while a part of it is cut with "…", and no tip while all of it is whole.
   * The tip of a step in a hidden branch has the name of the step on its first line, and the name of its branch on the second.
   * Asked again each time a cut part gets another size: as the side bar is filled, as 'Links' opens, as the view gets another size, or as a font loads. */
  // only a part with a set number of lines is cut at its foot. Any other part is cut only sideways: its font can stand taller than its line, so its height tells nothing
  const cut = (e: Element): boolean =>
    e.scrollWidth > e.clientWidth || (getComputedStyle(e).webkitLineClamp !== 'none' && e.scrollHeight > e.clientHeight + 1);
  const cuts = new ResizeObserver(es => {
    for (const { target } of es) {
      const r = target.closest<HTMLElement>('a.row, .row.off');
      if (!r) continue;
      const parts = [...r.querySelectorAll('.nm, .cut')];
      if (parts.some(cut)) r.title = parts.map(p => p.textContent ?? '').join('\n');
      else r.removeAttribute('title');
    }
  });
  ctx.off.signal.addEventListener('abort', () => cuts.disconnect());
  /** The 'Links' part of a step: a row for each link, which opens its page in a new tab. Its heading closes and opens it, and the view keeps which. */
  function linksPart(links: Link[]): HTMLElement {
    const rows: HTMLElement[] = [];
    for (const l of links) {
      const a = html('a', 'row'), go = html('span', 'go');
      a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      go.append(glyph(LINKS.open, 16, '↗'));
      const nm = html('span', 'strong nm', l.name);
      a.append(glyph(l.icon && art(l.icon) ? l.icon : LINKS.link, 20, ''), nm, go);
      cuts.observe(nm);
      a.addEventListener('click', e => { if (e.timeStamp < ctx.noClick) e.preventDefault(); });
      rows.push(a);
    }
    const { part, head: fold, setOpen } = ctx.foldPart('Links', LINKS.fold, ...rows);
    fold.addEventListener('click', e => {
      ctx.linksOpen = !ctx.linksOpen;
      setOpen(ctx.linksOpen);
      // where the side bar is a sheet at the bottom, its top moves: the second click of a double click, or of a double tap, lands on what moved under it, and does nothing there,
      // and the picked thing stays clear of the sheet
      if (fit.bottom) ctx.noClick = e.timeStamp + 500;
      ctx.uncover();
      ctx.save();
    });
    setOpen(ctx.linksOpen);
    return part;
  }
  /** What is in a branch, in the order of the plan: its own steps, each group that is one step far out, and the branches of a branching or of a group inside a group. */
  const inIt = (b: TBranch): Thing[] => b.items.flatMap((it): Thing[] => (isKids(it) && !ctx.byPod.has(it.key) ? it.kids : [it]));
  function sideOf(t: Thing): Node[] {
    // in edit mode the side bar is fields (edit-side.ts)
    if (ctx.editing()) return ctx.editSide(t);
    const close = html('button', 'close', '×');
    close.title = 'Close (Esc)'; close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => pick(null));
    const out: Node[] = [close];
    // where it sits: the branches around it, and the group that stands for it far out, the outermost first
    const path = html('nav', 'path');
    const around: (TBranch | TSplit)[] = [];
    for (let b: TBranch | undefined = isBranch(t) ? t : t.owner; b; b = b.parent) {
      if (b !== t && !sole(b)) around.push(b);
      if (b.pod?.kids.includes(b)) around.push(b.pod);
    }
    for (const at of around) {
      // a crumb is text in the line of the path, so a long name wraps between its words, as a <button> never does. Tab reaches it, and Enter or Space presses it
      const crumb = html('span', 'crumb', at.name ?? 'Branch');
      crumb.setAttribute('role', 'button');
      crumb.tabIndex = 0;
      crumb.addEventListener('click', () => pick(at));
      crumb.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        pick(at);
      });
      path.prepend(crumb);
    }
    // back to what the side bar showed before, at the top left, across from the close button
    const was = ctx.past.length ? thingOf(ctx.past[ctx.past.length - 1]) : undefined;
    if (was) {
      const back = html('button', 'back'), top = html('div', 'top');
      back.append(glyph(ARROW.left, 20, '←'));
      back.title = `Back to ${isStep(was) ? was.node.name : was.name ?? 'Branch'}`;
      back.setAttribute('aria-label', 'Back');
      back.addEventListener('click', goBack);
      back.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') ctx.aim(was); });
      back.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') ctx.aim(null); });
      top.append(back);
      if (path.childElementCount) top.append(path);
      out.push(top);
    } else if (path.childElementCount) out.push(path);
    out.push(ctx.heading(t, 'h2', 36), facts(t));
    if (isStep(t)) {
      const d = t.node;
      // what blocks it comes first: the steps it waits for that are not done, and the button that shows only them and it
      const holds = t.state === 'blocked' ? blockers(t) : [];
      if (holds.length) {
        const button = html('button', 'show-only', 'Show only blockers');
        button.addEventListener('click', () => ctx.showOnly(t));
        // 'Show only blockers' shows only those on the plan
        out.push(part('Blocked by', ...holds.map(row), ...(holds.some(h => !h.hidden) ? [button] : [])));
      }
      if (d.links?.length) out.push(linksPart(d.links));
      if (d.why) out.push(part('Why', html('p', '', d.why)));
      if (d.doneWhen) out.push(part('Done when', html('p', '', d.doneWhen)));
      const start = day(d.start), end = day(d.end), due = day(d.deadline);
      if (start || end) out.push(part('Planned', html('p', '', `${start ?? '?'} to ${end ?? '?'}`)));
      if (due) out.push(part('Deadline', html('p', '', due)));
    } else if (isBranch(t)) {
      if (t.holds) out.push(html('p', 'lead', t.holds));
      out.push(part('In it', ...inIt(t).map(row)));
      // a group holds its tracks, or its steps in a row
    } else out.push(part('In it', ...(sole(t.kids[0]) ? inIt(t.kids[0]) : t.kids).map(row)));
    return out;
  }
  /** Keeps the picked thing in sight, clear of the side bar, by scrolling the plan. Its size never changes.
   * With `whole`, the plan also scrolls up or down to it where the side bar is at the side: for a pick that is not where the user clicked it, as a reload brings it back. */
  function uncover(whole = false): void {
    // a plan that runs under the side bar scrolls, up to its last step clear of it, and one that fits the room again when the side bar closes does not
    ctx.clear();
    if (!ctx.picked) return;
    // a step or a branch that is not drawn is kept in sight by the pill of the closed track it is in, or far out by the step that stands for its group
    // a branch is its name and, where it is a closed track, its pill under it: both are kept clear
    const own = isBranch(ctx.picked) ? [ctx.pieceEls.get(`${ctx.picked.key}:cap`), ctx.pieceEls.get(`${ctx.picked.key}:bar`)].filter(drawn) : [];
    const e = own.length ? null : (isStep(ctx.picked) ? [ctx.nodeEls.get(ctx.picked.node.id)!.g, ...ctx.stands(ctx.picked.owner, ctx.picked.owner.pod)] : isBranch(ctx.picked) ? ctx.stands(ctx.picked.parent, ctx.picked.pod) : [ctx.podEls.get(ctx.picked.key)!.g, ctx.pieceEls.get(`${ctx.picked.kids[0].key}:frame`), ...ctx.picked.kids.flatMap(c => [ctx.pieceEls.get(`${c.key}:cap`), ctx.pieceEls.get(`${c.key}:bar`)]), ...ctx.picked.nodes.slice(-1).map(n => ctx.nodeEls.get(n.node.id)!.g)]).find(drawn);
    const rs = (own.length ? own : e ? [e] : []).map(x => x.getBoundingClientRect()).filter(b => b.width);
    const r = rs.length ? union(rs) : null, s = side.getBoundingClientRect(), st = stage.getBoundingClientRect();
    if (!r) return;
    if (fit.bottom) {
      // under the sheet, or over the room: its middle goes to the middle of the strip of plan over the sheet; sideways only as far as keeps it 24 px inside
      const top = st.top + PAD.t, bottom = s.top - 16;
      const dy = r.bottom > bottom || r.top < top ? (r.top + r.bottom) / 2 - (top + bottom) / 2 : 0;
      const dx = r.left - 24 < st.left ? r.left - 24 - st.left : r.right + 24 > st.right ? r.right + 24 - st.right : 0;
      // where the plan was before the sheet opened, and where this glide leaves it, as far as the ends of the stage allow
      const now: [number, number] = [stage.scrollLeft, stage.scrollTop];
      const to: [number, number] = [now[0] + clamp(dx, -now[0], stage.scrollWidth - stage.clientWidth - now[0]), now[1] + clamp(dy, -now[1], stage.scrollHeight - stage.clientHeight - now[1])];
      ctx.sheetFrom = { at: ctx.sheetFrom?.at ?? now, to };
      if (dx || dy) ctx.glide(dx, dy);
      return;
    }
    if (whole) return ctx.sight(r);
    const dx = r.right + 24 > s.left ? r.right + 24 - s.left : r.left - 24 < st.left ? r.left - 24 - st.left : 0;
    if (dx) ctx.glide(dx, 0);
  }
  /** Picks a thing, or with null lets go. `back` is a pick of what the side bar showed before. */
  function pick(t: Thing | null, back = false, quiet = false): void {
    if (t === ctx.picked) return;
    // a switch after a pick holds the plan by the picked step, from where it is now
    ctx.been = null;
    if (!quiet) ctx.sideAsked = null;
    // the side bar takes the place of the popup and of the list of branches; a redraw that picks again leaves them
    if (t && !quiet) { ctx.setPopup(false); ctx.setBranches(false); }
    // all comes back first, around a step picked among those that show
    if (ctx.only) ctx.endOnly(t && isStep(t) ? t : undefined);
    if (!t) ctx.past = [];
    else if (ctx.picked && !back) ctx.past.push(refOf(ctx.picked));
    // a row that is pressed goes with the old side bar, and never hears the pointer leave
    ctx.light(ctx.rowHot, 'hot', ctx.rowHot === ctx.hot);
    ctx.rowHot = null;
    ctx.aim(null);
    ctx.light(ctx.picked, 'picked', false);
    // the sheet at the bottom closes with the plan where its glides left it: the plan goes back to where it was before the sheet opened
    const home = !t && fit.bottom && ctx.sheetFrom && Math.hypot(stage.scrollLeft - ctx.sheetFrom.to[0], stage.scrollTop - ctx.sheetFrom.to[1]) <= 2 ? ctx.sheetFrom.at : null;
    if (!t) ctx.sheetFrom = null;
    ctx.picked = t;
    ctx.light(ctx.picked, 'picked', true);
    side.hidden = !t;
    if (t) {
      cuts.disconnect();
      side.replaceChildren(...sideOf(t));
      side.scrollTop = 0;
    }
    uncover();
    if (home) ctx.glide(home[0] - stage.scrollLeft, home[1] - stage.scrollTop);
    // the tip of what is under the pointer goes when that is picked, and comes back when it is let go
    ctx.hover(ctx.hot);
    ctx.save();
  }
  for (const where of [stage, head]) {
    where.addEventListener('click', e => {
      if (ctx.dragged || e.timeStamp < ctx.noClick) return;
      // asked of the view's own root, which may be a shadow root: there the page would answer with the box itself
      const t = ctx.thingAt((host.getRootNode() as Document | ShadowRoot).elementFromPoint(e.clientX, e.clientY));
      // a finger held down is no tap: a long press does nothing
      if (ctx.lastPointer === 'touch' && e.timeStamp - ctx.pressedAt > TAP.HOLD) return;
      if (ctx.lastPointer !== 'touch') {
        if (ctx.only && !t) ctx.endOnly();
        else pick(t);
        return;
      }
      // what was tapped, by what it is called, so a redraw in the wait does not lose it; in edit mode, a tap near a line or in a bend only shows the marks there
      const ref = t && refOf(t), marks = ctx.marksTake(e.clientX, e.clientY, t);
      const act = (): void => {
        if (marks) return;
        const now = ref ? thingOf(ref) ?? null : null;
        if (ctx.only && !now) ctx.endOnly();
        else pick(now);
      };
      const was = ctx.tapWait;
      if (was) { window.clearTimeout(was.timer); ctx.tapWait = null; }
      if (was && e.timeStamp - was.t < TAP.MS && Math.hypot(e.clientX - was.x, e.clientY - was.y) < TAP.PX) {
        // the step under the finger stays put, and so does the sheet: the move ends with no glide for what it shows
        if (ctx.plan && ctx.all.length && ctx.target < ctx.K && !ctx.only) { ctx.setPopup(false); ctx.go(ctx.target + 1, ctx.nearest(ctx.all, was.x, was.y), false); }
        return;
      }
      // a tap somewhere else: the one before it acts now
      was?.act();
      ctx.tapWait = { x: e.clientX, y: e.clientY, t: e.timeStamp, act, timer: window.setTimeout(() => { ctx.tapWait = null; act(); }, TAP.MS) };
    });
  }
  /** A tap that waits to pick is dropped when the plan moves before it picks: a swipe that comes right after it, or a pinch. */
  function dropTap(): void {
    if (!ctx.tapWait) return;
    window.clearTimeout(ctx.tapWait.timer);
    ctx.tapWait = null;
  }
  stage.addEventListener('pointercancel', e => { if (e.pointerType === 'touch') dropTap(); });
  // how far down the side bar is scrolled is kept once the scroll rests, as the place of the plan is
  side.addEventListener('scroll', () => {
    // a scroll to another point than the one the start asked for, as far as the side bar goes, is the user's
    if (ctx.sideAsked !== null && Math.abs(side.scrollTop - Math.min(ctx.sideAsked, side.scrollHeight - side.clientHeight)) >= 1) ctx.sideAsked = null;
    window.clearTimeout(ctx.saving);
    ctx.saving = window.setTimeout(ctx.save, 200);
  });
  /** Shows again what the side bar showed before, that is still in the plan. */
  function goBack(): void {
    while (ctx.past.length) {
      const t = thingOf(ctx.past.pop()!);
      if (t) return pick(t, true);
    }
  }

  /** Fills the side bar again for what is picked, as edit mode starts. */
  function refreshSide(): void {
    if (!ctx.picked || side.hidden) return;
    cuts.disconnect();
    side.replaceChildren(...sideOf(ctx.picked));
  }

  return { thingOf, uncover, pick, dropTap, refreshSide };
}

export type SidePart = ReturnType<typeof sidePart>;
