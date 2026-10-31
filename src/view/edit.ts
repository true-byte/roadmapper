// 'Edit on page': where the page can write the roadmap file it shows (options.save), the zoom control ends with 'Edit'. In edit mode the page changes a copy of the roadmap
// in memory: each change goes through the edit model (src/roadmap/edit.ts), which refuses what the file check refuses, and the plan is drawn again from the copy, at the level it is at.
// 'Save' hands the copy to options.save and leaves edit mode; 'Cancel' drops every change. Ctrl+Z undoes the last change since 'Edit', and Ctrl+Shift+Z redoes it.
// A text the page gets in edit mode, such as the file saved by another hand, is not drawn: 'Save' overwrites that file, and 'Cancel' draws it.
// Leaving the page with changes not saved brings the browser's own leave-page prompt. The marks on the plan are edit-marks.ts, and the side bar as fields edit-side.ts.
import { EDIT } from '../icons/icons.js';
import { checkRoadmap } from '../roadmap/check.js';
import { EditHistory, type Edited } from '../roadmap/edit.js';
import { RoadmapError } from '../roadmap/errors.js';
import type { Roadmap } from '../roadmap/types.js';
import type { ViewContext } from './context.js';
import { html } from './dom.js';
import { drawMark } from './mark.js';
import type { Thing } from './plan.js';
import { refOf } from './side.js';

/** How long the plan waits after the last key typed in a field before it is drawn again. */
const TYPING_MS = 250;

/** The text of a roadmap as its file holds it after 'Save'. */
export const fileText = (r: Roadmap): string => `${JSON.stringify(r, null, 2)}\n`;

/** How a change is made. `field` names the field of the side bar it comes from: the keys typed in one field make one change, which one undo takes back.
 * `el` is that field: it turns red while the file check refuses what it holds. `typing` draws the plan once the keys stop, and keeps the side bar as it is.
 * `pick` is what to pick after the change, where the change does not say: a branch or a group by its key. */
export interface How {
  field?: string;
  el?: Element;
  typing?: boolean;
  pick?: { step?: string; key?: string };
}

export function editPart(ctx: ViewContext) {
  const { glyph, host, keys, off, once, options, side, zoom } = ctx;
  const save = options.save;
  /** The changes since 'Edit'; null out of edit mode. */
  let history: EditHistory | null = null;
  /** The name of the file, as the page last got it with a text. */
  let file: string | undefined;
  /** What 'Cancel' draws: the text the page showed at 'Edit', or the last text it got since. */
  let back: { text: string; file?: string } | null = null;
  /** Is a save on its way; and the error of the last save, until the next change or press. */
  let busy = false, failed: string | null = null;
  /** The draw that waits for the keys to stop, what it picks then, and what was picked as they were typed. Is a press of the pointer on its way? */
  let typing = 0, want: { step?: string; key?: string } = {}, typedOn: Thing | null = null, pressed = false;

  // ---- the zoom control: 'Edit', and in edit mode 'Cancel' and 'Save' ----
  const tool = (cls: string, icon: string, sign: string, word: string): HTMLButtonElement => {
    const b = html('button', `edit-tool ${cls}`);
    b.append(glyph(icon, 20, sign), html('span', 'word', word));
    b.title = word;
    b.setAttribute('aria-label', word);
    return b;
  };
  const rule = html('span', 'rule edit-rule'), editB = tool('edit', EDIT.edit, '✎', 'Edit'), cancelB = tool('cancel', EDIT.cancel, '×', 'Cancel'), saveB = tool('save', EDIT.save, '✓', 'Save');
  if (save) zoom.append(rule, editB, cancelB, saveB);

  /** Shows the buttons of the mode the page is in. 'Save' is gray until something changed, then gold; red with the name of its error after a save that failed. */
  function bar(): void {
    if (!save) return;
    editB.hidden = !!history;
    cancelB.hidden = saveB.hidden = !history;
    saveB.setAttribute('aria-disabled', String(!history?.changed || busy));
    cancelB.setAttribute('aria-disabled', String(busy));
    saveB.classList.toggle('failed', !!failed);
    saveB.replaceChildren(failed ? drawMark('blocked') : glyph(EDIT.save, 20, '✓'), html('span', 'word', failed ?? 'Save'));
    saveB.title = failed ?? 'Save';
  }
  bar();

  /** What a change names to pick: a step by its id, or a branch or a group by its key. */
  const wanted = (): Thing | undefined => (want.step ? ctx.byId.get(want.step) : want.key ? ctx.byKey.get(want.key) ?? ctx.byPod.get(want.key) : undefined);
  /** Draws the plan from the copy. With `keepSide`, after keys typed in a field, only the plan is drawn again: the side bar stays as it is, with the field, its focus and its caret,
   * and what it shows stays picked, by the id its step has now. */
  function render(keepSide: boolean): void {
    window.clearTimeout(typing);
    typing = 0;
    if (!history) return;
    if (keepSide && !side.hidden && ctx.picked) {
      const was = ctx.picked, mine = was === typedOn;
      ctx.picked = null;
      ctx.show(fileText(history.now), file);
      // a thing picked since the keys were typed is picked again by what it is
      const t = (mine ? wanted() : undefined) ?? ctx.thingOf(refOf(was));
      want = {};
      if (t) {
        ctx.picked = t;
        ctx.light(t, 'picked', true);
        // the plan was laid out with nothing picked: what is picked comes clear of the side bar again
        ctx.uncover();
      } else {
        // what was picked is gone: the side bar closes
        ctx.picked = was;
        ctx.pick(null);
      }
      return;
    }
    // the side bar is made again: the field that had the focus gets it back, by its name
    const a = (host.getRootNode() as Document | ShadowRoot).activeElement;
    const f = a instanceof HTMLElement && side.contains(a) ? a.dataset.f : undefined;
    ctx.show(fileText(history.now), file);
    const t = wanted();
    want = {};
    if (t) ctx.pick(t, false, true);
    if (f) side.querySelector<HTMLElement>(`[data-f="${f}"]`)?.focus({ preventScroll: true });
  }
  /** Draws now what waits for the keys to stop. */
  function flushEdit(): void {
    if (typing) render(true);
  }
  /** Draws the plan once the keys stop: never while a press is on its way, so the press lands on what it pressed. */
  function later(): void {
    window.clearTimeout(typing);
    const draw = (): void => {
      if (pressed) typing = window.setTimeout(draw, TYPING_MS);
      else render(true);
    };
    typing = window.setTimeout(draw, TYPING_MS);
  }

  /** Makes a change of the model the page's: a refused one turns its field red and changes nothing. Then the plan is drawn again, and what the change names is picked. */
  function applyEdit(e: Edited, how: How = {}): boolean {
    const h = history;
    if (!h) return false;
    if (!e.ok) {
      how.el?.classList.add('bad');
      return false;
    }
    how.el?.classList.remove('bad');
    if (!how.typing) flushEdit();
    const was = h.now;
    h.push(e.roadmap, how.field);
    failed = null;
    want = { step: e.step ?? how.pick?.step, key: e.key ?? how.pick?.key };
    if (how.typing) {
      typedOn = ctx.picked;
      later();
    } else if (h.now !== was) render(false);
    else {
      // a move to where it already is: only the pick
      const t = wanted();
      want = {};
      if (t) ctx.pick(t, false, true);
    }
    bar();
    return true;
  }
  /** Undoes the last change, or with `redo` does again the change last undone. */
  function undo(redo = false): void {
    const h = history;
    if (!h) return;
    flushEdit();
    const was = h.now;
    if (redo) h.redo();
    else h.undo();
    if (h.now === was) return;
    failed = null;
    render(false);
    bar();
  }

  // ---- edit mode ----
  function enter(): void {
    if (history || !save || host.classList.contains('broken')) return;
    const r = checkRoadmap(ctx.shown).roadmap;
    if (!r) return;
    history = new EditHistory(r);
    back = { text: ctx.shown, file };
    failed = null;
    ctx.setPopup(false);
    ctx.setBranches(false);
    if (ctx.only) ctx.endOnly();
    // each change draws the plan where it is: never the first view again
    if (ctx.opened) ctx.opened.moved = true;
    host.classList.add('editing');
    ctx.refreshSide();
    ctx.marksOn();
    bar();
  }
  /** Leaves edit mode: with `keep`, the plan as it was saved; else as it was at 'Edit', or as the last text the page got since. */
  function leave(keep: boolean): void {
    const h = history;
    if (!h || !back) return;
    window.clearTimeout(typing);
    typing = 0;
    const to = keep ? { text: fileText(h.now), file } : back;
    history = null;
    back = null;
    failed = null;
    host.classList.remove('editing');
    ctx.marksOff();
    ctx.show(to.text, to.file);
    bar();
  }
  /** Hands the plan to options.save. Once the file is written the page leaves edit mode; a change made meanwhile keeps it there, to be saved too. */
  async function commit(): Promise<void> {
    const h = history;
    if (!h || !save || busy || !h.changed) return;
    flushEdit();
    const sent = h.now;
    busy = true;
    failed = null;
    bar();
    try {
      await save(structuredClone(sent));
      if (off.signal.aborted) return;
      busy = false;
      if (history !== h) return;
      // the file holds this plan now: 'Cancel' comes back to it, and a change made meanwhile is a change from it, with the ids it has
      back = { text: fileText(sent), file };
      if (h.now === sent) leave(true);
      else {
        history = new EditHistory(sent);
        history.push(h.now);
      }
    } catch (e) {
      if (off.signal.aborted) return;
      busy = false;
      failed = e instanceof RoadmapError ? e.error : 'Not saved';
    }
    bar();
  }

  editB.addEventListener('click', enter);
  // while a save is on its way, the file may already hold the plan: 'Cancel' waits for it
  cancelB.addEventListener('click', () => { if (!busy) leave(false); });
  saveB.addEventListener('click', () => void commit());
  if (save) {
    // Ctrl+Z and Ctrl+Shift+Z, or Ctrl+Y, in a field too: the change of a field is one change of the plan
    keys.addEventListener('keydown', ev => {
      const e = ev as KeyboardEvent, k = e.key.toLowerCase();
      if (!history || !(e.ctrlKey || e.metaKey) || e.altKey || (k !== 'z' && k !== 'y')) return;
      e.preventDefault();
      undo(k === 'y' || e.shiftKey);
    }, once);
    host.addEventListener('pointerdown', () => { pressed = true; }, { capture: true, signal: off.signal });
    for (const end of ['pointerup', 'pointercancel']) window.addEventListener(end, () => { pressed = false; }, { capture: true, signal: off.signal });
    // leaving the page with changes not saved: the browser's own prompt
    window.addEventListener('beforeunload', e => {
      if (!history?.changed) return;
      e.preventDefault();
      e.returnValue = '';
    }, once);
    off.signal.addEventListener('abort', () => window.clearTimeout(typing));
  }

  /** Draws a text the page got, or in edit mode keeps it for 'Cancel'. */
  function showFile(text: string, name?: string): void {
    file = name;
    if (history) {
      back = { text, file: name };
      return;
    }
    ctx.show(text, name);
  }

  return {
    editing: (): boolean => !!history,
    showFile,
    /** The roadmap as the edit has it now. */
    editNow: (): Roadmap | undefined => history?.now,
    /** The ids of the steps at 'Edit': a new step never takes one, and only a new step's id follows its name. */
    editOld: (): ReadonlySet<string> => history?.old ?? new Set(),
    applyEdit,
  };
}

export type EditPart = ReturnType<typeof editPart>;
