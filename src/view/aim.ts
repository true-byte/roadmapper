// A name pointed at in the side bar shows where its thing is on the plan: a ring around it, or where it is out of sight, an arrow at the edge toward it.
import type { ViewContext } from './context.js';
import { drawn } from './draw.js';
import { clamp, union } from './math.js';
import { isBranch, isStep, type Thing } from './plan.js';

export function aimPart(ctx: ViewContext) {
  const { aimLayer, arrow, fit, host, popup, ring, side, stage, zoom } = ctx;

  /** What the name pointed at stands for. */
  let aimed: Thing | null = null;
  function aim(t: Thing | null): void {
    if (t === aimed) return;
    aimed = t;
    // the ring comes in again for each new name: hidden and shown, it plays its look from the start
    ring.hidden = arrow.hidden = true;
    void ring.offsetWidth;
    seek();
  }
  /** Where a thing is on the screen now: the box of what stands for it, round for a step or a pill, and none where nothing of it is drawn. */
  function spot(t: Thing): { box: DOMRect; round: boolean } | null {
    const stand = isStep(t) ? ctx.standFor(t) : isBranch(t) ? [...ctx.pills(t), ...ctx.stands(t.parent, t.pod)].find(drawn) : [ctx.podEls.get(t.key)!.g, ...ctx.stands(t.owner, t.owner.pod)].find(drawn);
    if (stand) {
      // of a step or a group step, its body: not the disc a finger hits around it
      const body = stand.matches('.zn') ? [...stand.querySelectorAll('.coin, .aura, .ms, .ic, .st')].filter(drawn).map(e => e.getBoundingClientRect()).filter(r => r.width) : [];
      return { box: body.length ? union(body) : stand.getBoundingClientRect(), round: true };
    }
    if (isStep(t)) return null;
    // an open branch is its lines and its name; an open group is its frame
    const parts = isBranch(t) ? (ctx.partsOf.get(t) ?? []).filter(e => e.matches('.lane, .cap')) : [ctx.pieceEls.get(`${t.kids[0].key}:frame`)];
    const shown = parts.filter((e): e is SVGElement => drawn(e as SVGElement | undefined)).map(e => e.getBoundingClientRect()).filter(r => r.width || r.height);
    return shown.length ? { box: union(shown), round: false } : null;
  }
  /** Puts the ring around the thing aimed at, where it is in sight: in the part of the page where the plan shows, clear of the side bar and of the zoom control.
   * Else the arrow stands at the edge of that part, on the line from its middle to the thing, and points that way. */
  function seek(): void {
    const at = aimed && !side.hidden && !ctx.only ? spot(aimed) : null;
    if (!at) { ring.hidden = arrow.hidden = true; return; }
    const st = stage.getBoundingClientRect(), z = zoom.getBoundingClientRect();
    const sb = side.getBoundingClientRect();
    // the popup, while it is open, lies over the bottom of the room too
    const pt = popup.hidden ? Infinity : popup.getBoundingClientRect().top;
    const room = fit.bottom ? new DOMRect(st.left, st.top, st.width, Math.min(sb.top, pt) - 12 - st.top) : new DOMRect(st.left, st.top, sb.left - 12 - st.left, Math.min(z.top, pt) - 12 - st.top);
    const o = host.getBoundingClientRect();
    Object.assign(aimLayer.style, { left: `${room.left - o.left}px`, top: `${room.top - o.top}px`, width: `${room.width}px`, height: `${room.height}px` });
    const b = at.box, cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    // a step is in sight when its middle is; a branch or a group when enough of it is to be seen
    const seen = at.round
      ? cx > room.left && cx < room.right && cy > room.top && cy < room.bottom
      : Math.min(b.right, room.right) - Math.max(b.left, room.left) > 40 && Math.min(b.bottom, room.bottom) - Math.max(b.top, room.top) > 16;
    if (seen) {
      const pad = 8;
      Object.assign(ring.style, { left: `${b.left - room.left - pad}px`, top: `${b.top - room.top - pad}px`, width: `${b.width + 2 * pad}px`, height: `${b.height + 2 * pad}px` });
      ring.classList.toggle('round', at.round);
    } else {
      // from the middle of the room to the nearest point of the thing, as far as the edge of the room less the arrow
      const mx = room.width / 2, my = room.height / 2, inset = 34;
      const dx = clamp(mx, b.left - room.left, b.right - room.left) - mx, dy = clamp(my, b.top - room.top, b.bottom - room.top) - my;
      const k = Math.min(Math.abs((mx - inset) / (dx || 1e-6)), Math.abs((my - inset) / (dy || 1e-6)));
      arrow.style.left = `${mx + dx * k}px`;
      arrow.style.top = `${my + dy * k}px`;
      arrow.style.setProperty('--turn', `${Math.atan2(dy, dx).toFixed(4)}rad`);
    }
    ring.hidden = !seen;
    arrow.hidden = seen;
  }

  return { aim, seek };
}

export type AimPart = ReturnType<typeof aimPart>;
