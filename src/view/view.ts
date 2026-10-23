// One roadmap view: the title, the key, the plan at each zoom level, the zoom control, the tip, the side bar and the error list, and in the app the button 'Export'.
// It gets the roadmap as text and does not know where the text comes from. All its state lives in the context that mountRoadmap() makes, so each view stands alone.
// A step, a group or a branch answers the pointer: a short tip on a hover, and the side bar with its data on a click. A click never zooms.
// Its look is view.css, which takes every color and font from the variables of the theme (src/themes/). The theme also names the icon set.
// The view is made of parts, one file each in this folder, such as side.ts for the side bar: each gets the context and gives back what the other parts call (context.ts).
import type { IconSet } from '../icons/icons.js';
import type { FileError } from '../roadmap/errors.js';
import type { Roadmap } from '../roadmap/types.js';
import { aimPart } from './aim.js';
import { blockersPart } from './blockers.js';
import { branchesPart } from './branches.js';
import { initialState, type ViewContext } from './context.js';
import { makeDom } from './dom.js';
import { drawPart } from './draw.js';
import { errorListPart } from './error-list.js';
import { exportPart } from './export.js';
import { factsPart } from './facts.js';
import { fontsPart } from './fonts.js';
import { framePart } from './frame.js';
import { hoverPart } from './hover.js';
import { inputPart } from './input.js';
import { movesPart } from './moves.js';
import { openingPart } from './opening.js';
import { paintPart } from './paint.js';
import { placePart } from './place.js';
import { resizePart } from './resize.js';
import { scalePart } from './scale.js';
import { scrollPart } from './scroll.js';
import { sidePart } from './side.js';
import { storePart } from './store.js';
import { tidyPart } from './tidy.js';
import { toolbarPart } from './toolbar.js';
import { touchPart } from './touch.js';

export interface RoadmapView {
  /** Draws the roadmap from the text of a roadmap file, named `file` on the error list. A broken text shows the error list in place of the plan,
   * and the last good drawing comes back as it was with the next good text. */
  show(text: string, file?: string): void;
  /** Shows an error that is not in a text, such as a file that did not come, on the error list. */
  fail(error: FileError, file?: string): void;
  /** Takes the view off the page: its listeners, its timers and what it drew. */
  destroy(): void;
}

export interface ViewOptions {
  /** The name the view keeps its level, its view and its place under, in localStorage. With none, nothing is kept. */
  store?: string;
  /** Called after each good draw. */
  onDraw?: (roadmap: Roadmap) => void;
  /** The element of another page that the view sits in as a box. The keys are the view's only while that element has the focus,
   * and the wheel up and down scrolls the page. With none, the view is the whole page: it takes the keys and the wheel. */
  box?: HTMLElement;
  /** The icons of the set the theme names, for this view only, in place of the set on the page: those a page holds for its roadmap. */
  icons?: IconSet;
  /** Makes the export of the roadmap shown, as one file to save, from the text of its file: the export for strangers, or with `private` the whole roadmap.
   * It throws a RoadmapError for a roadmap it cannot export. With it, the popup ends with the switch 'Include private items' and the button 'Export',
   * which saves that file. With none, the popup has neither: only the app gives it (src/app/main.ts). */
  exportFile?: (text: string, keep: { private: boolean }) => Promise<File>;
}

/** The parts of a view, in the order they are made. Each puts its listeners on the page as it is made: the input before touch, as each listens to a press on the view first. */
const PARTS = [drawPart, framePart, placePart, tidyPart, openingPart, toolbarPart, branchesPart, movesPart, storePart, scalePart, scrollPart, inputPart, touchPart,
  hoverPart, factsPart, sidePart, aimPart, blockersPart, resizePart, paintPart, errorListPart, fontsPart, exportPart];

/** Puts one roadmap view into `host`. */
export function mountRoadmap(host: HTMLElement, options: ViewOptions = {}): RoadmapView {
  /** Ends every listener the view put on the page, at destroy(). */
  const off = new AbortController();
  const once = { signal: off.signal };
  /** The keys go to the view only from this: the whole page, or the box it sits in. */
  const keys: EventTarget = options.box ?? window;
  const dom = makeDom(host, options);

  // #z=1.5 in the address holds the page at that point of the move, to look at one frame of it; #u=0.5 does the same for the change of view, at the level nearest to z;
  // #t=0.5 for the turn between the two layouts, and #w=0.5 for the flip of the labels.
  // The address of another page is that page's: a box never reads it.
  const held = (name: string): number | null => {
    if (options.box) return null;
    const asked = new RegExp(`[#&]${name}=([\\d.]+)`).exec(location.hash);
    return asked && Number.isFinite(Number(asked[1])) ? Number(asked[1]) : null;
  };
  const frozen = held('z'), frozenU = held('u'), frozenT = held('t'), frozenW = held('w');
  const still = frozen !== null || frozenU !== null || frozenT !== null || frozenW !== null;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');

  // The context of this view. It is whole once each part is in it: no part calls another before that.
  const ctx = { host, options, off, once, keys, ...dom, frozen, frozenU, frozenT, frozenW, still, calm, ...initialState() } as ViewContext;
  for (const part of PARTS) Object.assign(ctx, part(ctx));
  // the mode the user picked, or else the device's, from the first paint on: before the first draw, and also under the error list of a broken file
  ctx.setMode(still ? null : ctx.kept()?.mode);

  function destroy(): void {
    if (off.signal.aborted) return;
    ctx.save();
    off.abort();
    ctx.sizer.disconnect();
    window.clearTimeout(ctx.saving);
    window.clearTimeout(ctx.tidy);
    if (ctx.tapWait) window.clearTimeout(ctx.tapWait.timer);
    cancelAnimationFrame(ctx.raf);
    cancelAnimationFrame(ctx.sraf);
    cancelAnimationFrame(ctx.praf);
    host.replaceChildren();
    host.classList.remove('roadmap', 'box', 'only', 'broken');
    host.removeAttribute('data-moving');
  }

  return { show: ctx.show, fail: ctx.fail, destroy };
}
