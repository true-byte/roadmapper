// The page of a view, made once by mountRoadmap(): the head, the stage with the plan, the zoom control, the popup with Export in the app, the list of branches, the grip,
// the tip, the side bar, the aim, the names of 'Show only blockers' and the error list. What it shows is drawn again on each good show().
// Also what the view reads of the theme and of the browser: the icon set, the padding of the stage, where the side bar goes, the layout, and how thick a scroll bar is.
import { ARROW, BRANCHES, INFO, iconSet } from '../icons/icons.js';
import { fontsOf } from './fonts.js';
import { SVG_NS } from './svg.js';
import type { ViewOptions } from './view.js';

/** What a group that is one step holds, drawn the way an icon is, for a box of 24 by 24: lines that part for tracks side by side, steps on a line for steps in a row. Drawn for this view, not taken from the icon set. */
export const HELD = {
  tracks: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M3 12h5c4.5 0 4-6.5 8.5-6.5H21M8 12c4.5 0 4 6.5 8.5 6.5H21"/></g>',
  row: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M7.5 12h2m5 0h2"/><circle cx="5" cy="12" r="2.5"/><circle cx="12" cy="12" r="2.5"/><circle cx="19" cy="12" r="2.5"/></g>',
};

/** How many views were put on this page: each popup gets an id of its own. */
let mounted = 0;

/** An element of the page, with its class and its text. */
export function html<T extends keyof HTMLElementTagNameMap>(tag: T, cls: string, text?: string): HTMLElementTagNameMap[T] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

const pad = (s: string): number => parseFloat(s) || 0;

export function makeDom(host: HTMLElement, options: ViewOptions) {
  host.classList.add('roadmap');
  host.classList.toggle('box', !!options.box);
  fontsOf(host);
  // the icon set that the theme names, or the icons of it that the view is given; a step whose icon is not in it keeps its mark
  const icons = options.icons ?? iconSet(getComputedStyle(host).getPropertyValue('--icon-set').trim());
  const ICON_BOX = icons?.size ?? 24;
  const art = (name: string): string | undefined => icons?.art(name);
  /** An icon of the set as a small picture of its own, or a sign for it where the set has none. */
  function glyph(name: string, size: number, sign: string): Node {
    const a = art(name);
    if (!a) return document.createTextNode(sign);
    const e = document.createElementNS(SVG_NS, 'svg');
    e.setAttribute('viewBox', `0 0 ${ICON_BOX} ${ICON_BOX}`);
    e.setAttribute('width', String(size)); e.setAttribute('height', String(size));
    e.setAttribute('aria-hidden', 'true');
    e.innerHTML = a;
    return e;
  }

  const head = html('header', 'head');
  const stage = html('div', 'stage');
  const sheet = html('div', 'sheet');
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'plan');
  svg.setAttribute('role', 'img');
  sheet.append(svg);
  stage.append(sheet);

  // The zoom control: one stop for each level, a knob that moves with the zoom, and a button at each end.
  const zoom = html('nav', 'zoom');
  zoom.setAttribute('aria-label', 'View');
  const out = html('button', 'step', '−'), into = html('button', 'step', '+');
  out.title = 'Zoom out (−)'; out.setAttribute('aria-label', 'Zoom out');
  into.title = 'Zoom in (+)'; into.setAttribute('aria-label', 'Zoom in');
  const stops = html('div', 'stops');
  const knob = html('span', 'knob');
  stops.append(html('span', 'rail'), knob);
  // at its end, at every size: the button that opens the popup
  const rule = html('span', 'rule');
  const info = html('button', 'info');
  info.append(glyph(INFO.open, 24, 'i'));
  info.setAttribute('aria-label', 'Key');
  info.title = 'Key';
  info.setAttribute('aria-expanded', 'false');
  zoom.append(out, stops, into, rule, info);
  // The popup: what the marks mean, then the switch between the two views and the pair of layouts. It lies over the plan by the end of the zoom control, and the plan stays live under it.
  const popup = html('div', 'popup');
  popup.id = `roadmapper-key-${++mounted}`;
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', 'Key');
  popup.hidden = true;
  info.setAttribute('aria-controls', popup.id);
  /** One mark and one word for each state that is on the plan: filled by draw(). */
  const keyList = html('ul', 'key');
  // the switch between the two views: on, every step is its mark; off, every step is its icon
  const hide = html('button', 'switch');
  hide.append(html('span', 'word', 'Hide node icons'));
  hide.setAttribute('role', 'switch');
  hide.setAttribute('aria-label', 'Hide node icons');
  hide.title = 'Hide node icons (I)';
  // the pair of layouts: the drawing of a group of tracks, as it is drawn for across, and turned for down
  const seg = html('div', 'seg');
  seg.setAttribute('role', 'radiogroup');
  seg.setAttribute('aria-label', 'Layout');
  const flows = (['h', 'v'] as const).map(f => {
    const b = html('button', `flow ${f}`), name = f === 'h' ? 'Horizontal' : 'Vertical', g = document.createElementNS(SVG_NS, 'svg');
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', name);
    b.title = name;
    b.dataset.flow = f;
    g.setAttribute('viewBox', '0 0 24 24');
    g.setAttribute('width', '24'); g.setAttribute('height', '24');
    g.setAttribute('aria-hidden', 'true');
    g.innerHTML = HELD.tracks;
    b.append(g);
    return b;
  });
  seg.append(...flows);
  // the switch between names shown and names hidden: on, the plan draws no word but the names of the versions. Every plan has it
  const hideL = html('button', 'switch');
  hideL.append(html('span', 'word', 'Hide labels'));
  hideL.setAttribute('role', 'switch');
  hideL.setAttribute('aria-label', 'Hide labels');
  hideL.title = 'Hide labels';
  // the two switches one over the other at the left, and the pair at the right of both
  const opts = html('div', 'opts');
  opts.append(hide, hideL, seg);
  // Export, only where the page makes the export (options.exportFile), after a hairline: the switch that keeps the private items in it, then the button that saves it,
  // as wide as the popup. The button's face is drawn by the export part (export.ts).
  const keepPrivate = html('button', 'switch');
  keepPrivate.append(html('span', 'word', 'Include private items'));
  keepPrivate.setAttribute('role', 'switch');
  keepPrivate.setAttribute('aria-label', 'Include private items');
  keepPrivate.title = 'Include private items';
  const exportButton = html('button', 'export');
  const exporting = html('div', 'exporting');
  exporting.append(keepPrivate, exportButton);
  popup.append(keyList, html('hr', ''), opts, ...(options.exportFile ? [html('hr', ''), exporting] : []));

  // The list of top-level branches: the button left of (i) opens it over the zoom control, as the popup. Each row shows or hides its branch, and the search finds rows by their names.
  const layers = html('button', 'layers');
  layers.append(glyph(BRANCHES.open, 24, '≡'));
  layers.setAttribute('aria-label', 'Branches');
  layers.title = 'Branches';
  layers.setAttribute('aria-expanded', 'false');
  const picker = html('div', 'picker');
  picker.id = `roadmapper-branches-${mounted}`;
  picker.setAttribute('role', 'dialog');
  picker.setAttribute('aria-label', 'Branches');
  picker.hidden = true;
  layers.setAttribute('aria-controls', picker.id);
  const findBox = html('label', 'find'), find = document.createElement('input');
  find.type = 'search';
  find.placeholder = 'Search';
  find.setAttribute('aria-label', 'Search');
  findBox.append(glyph(BRANCHES.search, 18, ''), find);
  const branchList = html('ul', 'branches');
  picker.append(findBox, branchList);
  // The grip on the top edge of the zoom control: it hides the control down to the grip alone, and brings it back
  const grip = html('button', 'grip');
  zoom.insertBefore(layers, info);
  zoom.prepend(grip);

  // The tip: the name, the state and one line. It stands over what is pointed at, and never takes the pointer.
  const tip = html('div', 'tip');
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  // The side bar: all that the plan says about the picked step or branch.
  const side = html('aside', 'side');
  side.setAttribute('aria-label', 'Details');
  side.hidden = true;
  // The error list: a broken file shows every error in place of the plan. The last good drawing stays under it, as it was.
  const errorList = html('section', 'errors');
  errorList.hidden = true;
  // the plan under it takes no wheel, touch or click
  for (const type of ['wheel', 'touchstart', 'touchmove', 'gesturestart', 'gesturechange', 'click', 'dblclick']) errorList.addEventListener(type, e => e.stopPropagation());
  // A name pointed at in the side bar: a ring around its thing on the plan, or an arrow at the edge of the plan's part of the page, toward it.
  const aimLayer = html('div', 'aim'), ring = html('div', 'ring'), arrow = html('div', 'arrow'), arrowBody = html('span', '');
  arrowBody.append(glyph(ARROW.right, 26, '→'));
  arrow.append(arrowBody);
  aimLayer.append(ring, arrow);
  ring.hidden = arrow.hidden = true;
  // While only a blocked step and its blockers show: their names at reading size, and the one button that brings all back.
  const names = html('div', 'names');
  const showAll = html('button', 'show-all', 'Show all');
  showAll.title = 'Show all (Esc)';
  names.hidden = showAll.hidden = true;
  host.replaceChildren(head, stage, zoom, popup, picker, tip, side, aimLayer, names, showAll, errorList);

  /** The padding of the stage, whether the side bar is a sheet at the bottom, and the layout the plan is drawn in until the user picks one. The size of the view picks them, so they are read again when it changes. */
  const PAD = { l: 0, t: 0, x: 0, y: 0 };
  const fit: { bottom: boolean; flow: 'h' | 'v' } = { bottom: false, flow: 'h' };
  /** Reads them from the theme. True when one changed. */
  function readFit(): boolean {
    const box = getComputedStyle(stage), was = [PAD.l, PAD.t, PAD.x, PAD.y, fit.bottom, fit.flow].join();
    PAD.l = pad(box.paddingLeft); PAD.t = pad(box.paddingTop);
    PAD.x = PAD.l + pad(box.paddingRight); PAD.y = PAD.t + pad(box.paddingBottom);
    fit.bottom = box.getPropertyValue('--sheet').trim() === 'bottom';
    fit.flow = box.getPropertyValue('--flow').trim() === 'down' ? 'v' : 'h';
    return [PAD.l, PAD.t, PAD.x, PAD.y, fit.bottom, fit.flow].join() !== was;
  }
  readFit();
  /** How thick a scroll bar is in this browser: 0 where the bars lie over the page. */
  const BAR = ((): number => {
    const d = html('div', '');
    d.style.cssText = 'position:absolute;top:-99px;width:50px;height:50px;overflow:scroll';
    // measured in the view, where the theme's scroll bars are, not the page's
    host.append(d);
    const n = d.offsetHeight - d.clientHeight;
    d.remove();
    return n;
  })();

  return { icons, ICON_BOX, art, glyph, head, stage, sheet, svg, zoom, out, into, stops, knob, rule, info, popup, keyList, hide, seg, flows, hideL, keepPrivate, exportButton, layers, picker, find, branchList, grip, tip, side, errorList, aimLayer, ring, arrow, names, showAll, PAD, fit, readFit, BAR };
}

/** The page of a view, and what the view reads of the theme and of the browser. */
export type Dom = ReturnType<typeof makeDom>;
