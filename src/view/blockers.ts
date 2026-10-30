// 'Show only blockers': all of the page goes soft but a blocked step and the steps that block it, and the page scales out only as far as they need to be in sight.
// Their names stay at reading size. 'Show all', Escape, or a click on empty space brings back the side bar, the scale and the place.
import type { ViewContext } from './context.js';
import { html } from './dom.js';
import { READ } from './frame.js';
import { clamp, union } from './math.js';
import { blockers, type TNode } from './plan.js';

/** Room around a step for its name at reading size: across, half of the widest name to each side, and two lines over it and under it; down, the widest name right of it, and a line over it and under it. */
const NAMED = { x: 72, y: 48 }, NAMED_DOWN = { x: 130, y: 32, min: 60 };

/** With the labels hidden: the air around them at each side. */
const BARE = { x: 24, y: 24 };

export function blockersPart(ctx: ViewContext) {
  const { fit, frozenT, host, names, PAD, showAll, stage, svg } = ctx;

  /** The room on the screen. */
  function roomBox(): DOMRect {
    const st = stage.getBoundingClientRect(), [rw, rh] = ctx.room();
    return new DOMRect(st.left + PAD.l, st.top + PAD.t, rw, rh);
  }
  /** Keeps sharp all that stands for the step and its blockers: each step, or the pill or the group step it is in. */
  function keepMarks(): void {
    for (const e of svg.querySelectorAll('.keep')) e.classList.remove('keep');
    if (ctx.only) for (const n of [ctx.only.n, ...ctx.only.keep]) for (const e of ctx.partsOf.get(n)!) e.classList.add('keep');
  }
  /** Shows only a blocked step and those of its blockers that are on the plan. `before` is the place that 'Show all' brings the plan back to, where that is not where the plan is now:
   * a redraw of the same text, as when a web font loads, shows them again with the place they had before. */
  function showOnly(n: TNode, before?: Pick<NonNullable<ViewContext['only']>, 'was' | 'place'>): void {
    const keep = blockers(n).filter(h => !h.hidden);
    if (ctx.only || !ctx.plan || !keep.length) return;
    ctx.setPopup(false);
    ctx.setBranches(false);
    ctx.endScale();
    const R = roomBox(), r = svg.getBoundingClientRect(), now = ctx.views[ctx.view][ctx.target].s / READ;
    ctx.only = { n, keep, ...(before ?? { was: { mag: now, x: (R.left + R.width / 2 - r.left) / ctx.scale, y: (R.top + R.height / 2 - r.top) / ctx.scale }, place: ctx.placeNow() }) };
    host.classList.add('only');
    showAll.hidden = false;
    ctx.hover(null);
    ctx.aim(null);
    keepMarks();
    // with the labels hidden their names are hidden too: the switch is the one rule for words on the plan
    if (ctx.labels) {
      names.replaceChildren(...[n, ...keep].map(s => html('div', s === n ? 'picked' : '', s.node.name)));
      names.hidden = false;
    }
    fitOnly();
    ctx.save();
  }
  /** Scales the page out as far as the step and its blockers need to be all in sight, never further in than the scale it had before, and puts them in the middle of the room.
   * Again where the room gets another size while they show. */
  function fitOnly(): void {
    if (!ctx.only) return;
    const R = roomBox(), r = svg.getBoundingClientRect(), now = ctx.views[ctx.view][ctx.target].s / READ, most = ctx.only.was.mag;
    // the box of what stands for them, in units of the plan, and the scale where it fits the room with their names around it, or with a little air where they have none
    const boxes = [ctx.only.n, ...ctx.only.keep].map(ctx.standFor).filter(e => !!e).map(e => e.getBoundingClientRect());
    if (!boxes.length) return;
    const b = union(boxes), bw = b.width / ctx.scale, bh = b.height / ctx.scale, x = (b.left + b.width / 2 - r.left) / ctx.scale, y = (b.top + b.height / 2 - r.top) / ctx.scale;
    // down, the names are right of the steps: the steps take the room less the widest name, and they and their names are in the middle
    const down = ctx.isDown() && ctx.labels, N = !ctx.labels ? BARE : down ? NAMED_DOWN : NAMED, wide = down ? R.width - N.x - 16 : R.width - 2 * N.x;
    let to = Math.min(most, wide / (READ * Math.max(bw, 1)), (R.height - 2 * N.y) / (READ * Math.max(bh, 1)));
    if (down) {
      // two of them side by side on one row: the one on the left keeps room for its name, on two lines at most, before the next; as far as all of them still fit across the room
      const across = (R.width - 16) / (READ * Math.max(bw, 1));
      const at = boxes.map(o => ({ x: (o.left + o.width / 2 - r.left) / ctx.scale, y: (o.top + o.height / 2 - r.top) / ctx.scale, half: o.width / 2 / ctx.scale }));
      for (const p of at) for (const q of at) {
        const gap = q.x - q.half - (p.x + p.half);
        if (q.x > p.x && gap > 0 && Math.abs(q.y - p.y) * READ * to < 32) to = Math.max(to, Math.min(most, across, (NAMED_DOWN.min + 16) / (READ * gap)));
      }
    }
    // down, left of the middle by the room the names take, as far as keeps the steps 8 px in from the left
    const half = (bw * READ * to) / 2, mid = down ? clamp((R.width - N.x) / 2, half + 8, R.width - half - 8) : R.width / 2;
    if (Math.abs(to - now) > 1e-3) {
      ctx.floor = to;
      ctx.scaleTo(to, x, y, mid, R.height / 2);
    } else ctx.glide(b.left + b.width / 2 - (R.left + mid), b.top + b.height / 2 - (R.top + R.height / 2));
    nameKept();
  }
  /** Brings all back: the side bar, the scale and the place. With `around`, the scale comes back around that step, which stays where it is. */
  function endOnly(around?: TNode): void {
    if (!ctx.only) return;
    const was = ctx.only.was, R = roomBox(), r = svg.getBoundingClientRect();
    ctx.only = null;
    host.classList.remove('only');
    showAll.hidden = names.hidden = true;
    names.replaceChildren();
    keepMarks();
    // the layout stayed while they showed: where the size of the view wants the other one by now, all comes back at once in it
    if (frozenT === null && !ctx.pickFlow && fit.flow !== ctx.flow) {
      ctx.mag = was.mag;
      ctx.floor = null;
      ctx.size();
      ctx.frame();
      ctx.resized(true, around);
      ctx.save();
      ctx.seek();
      return;
    }
    const stand = around && ctx.standFor(around)?.getBoundingClientRect();
    const done = (): void => { ctx.floor = null; ctx.size(); ctx.frame(); ctx.uncover(); ctx.save(); };
    if (Math.abs(ctx.views[ctx.view][ctx.target].s / READ - was.mag) < 1e-3) {
      ctx.floor = null;
      if (!around) ctx.glide(r.left + was.x * ctx.scale - (R.left + R.width / 2), r.top + was.y * ctx.scale - (R.top + R.height / 2));
      ctx.save();
    } else if (stand) {
      const cx = stand.left + stand.width / 2, cy = stand.top + stand.height / 2;
      ctx.scaleTo(was.mag, (cx - r.left) / ctx.scale, (cy - r.top) / ctx.scale, cx - R.left, cy - R.top, done);
    } else ctx.scaleTo(was.mag, was.x, was.y, R.width / 2, R.height / 2, done);
    ctx.seek();
  }
  showAll.addEventListener('click', () => endOnly());
  /** The names of the step and its blockers, at reading size however far out the page is: across, each over what stands for it, or under it where a name before is in the way;
   * down, each right of what stands for it, on its row, or under the name before where that is in the way. */
  function nameKept(): void {
    if (!ctx.only || !ctx.labels) return;
    const taken: DOMRect[] = [], down = ctx.isDown(), kept = [ctx.only.n, ...ctx.only.keep], stands = kept.map(ctx.standFor).map(e => e?.getBoundingClientRect()), R = roomBox();
    kept.forEach((n, i) => {
      const d = names.children[i] as HTMLElement | undefined, e = ctx.standFor(n);
      if (!d) return;
      d.hidden = !e;
      if (!e) return;
      const r = e.getBoundingClientRect();
      // down, a name is as wide as the room right of its step allows, before the next of them on its row and the edge of the room;
      // where that room is less than a short name needs, the name goes under its step, in the room
      let beside = true;
      if (down) {
        let room = R.right - r.right - 12;
        for (const o of stands) if (o && o.left > r.right && Math.abs(o.top + o.height / 2 - (r.top + r.height / 2)) < 32) room = Math.min(room, o.left - r.right - 16);
        beside = room >= NAMED_DOWN.min - 0.5;
        d.style.maxWidth = `${Math.round(beside ? Math.min(room, NAMED_DOWN.x) : NAMED_DOWN.x)}px`;
      } else d.style.maxWidth = '';
      const w = d.offsetWidth, h = d.offsetHeight, x = down ? (beside ? r.right + 8 : clamp(r.left, R.left, R.right - w)) : r.left + r.width / 2 - w / 2;
      const hit = (t: number): DOMRect | undefined => taken.find(o => o.left < x + w && x < o.right && o.top < t + h && t < o.bottom);
      const hits = (t: number): boolean => !!hit(t);
      let top = down ? (beside ? r.top + r.height / 2 - h / 2 : r.bottom + 6) : r.top - 6 - h;
      if (down) for (let o = hit(top); o; o = hit(top)) top = o.bottom + 4;
      else if (hits(top)) top = r.bottom + 6;
      const o = host.getBoundingClientRect();
      d.style.left = `${Math.round(x - o.left)}px`;
      d.style.top = `${Math.round(top - o.top)}px`;
      taken.push(new DOMRect(x, top, w, h));
    });
  }

  return { showOnly, fitOnly, endOnly, nameKept };
}

export type BlockersPart = ReturnType<typeof blockersPart>;
