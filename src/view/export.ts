// The part 'Export', at the end of the popup, where the page makes the export (options.exportFile), as the app does: the switch 'Include private items',
// and the button 'Export', which saves the export of the roadmap shown. The button then says 'Saved' with a check, in gold, for SAVED_MS.
// An export that cannot be made shows in the button as the error list shows an error: the mark of a blocked step and the name of the error, in red.
// That stays until the next press, a flip of the switch, a new text of the roadmap, or the popup closes.
import { EXPORT } from '../icons/icons.js';
import { RoadmapError, type ErrorName } from '../roadmap/errors.js';
import type { ViewContext } from './context.js';
import { html } from './dom.js';
import { drawMark } from './mark.js';

/** How long the button says 'Saved'. */
const SAVED_MS = 2000;

export function exportPart(ctx: ViewContext) {
  const { exportButton: button, glyph, keepPrivate, off, options, popup } = ctx;
  const make = options.exportFile;
  // a view with no Export, as the lib's, has nothing to draw and nothing to give back
  if (!make) return { resetExport: (): void => {} };
  let timer = 0;
  /** The address of the last file saved: it lives until the next save, or until the view goes. */
  let url = '';
  /** Is an export being made? A press meanwhile does nothing. */
  let busy = false;

  /** Draws the button: 'Export', 'Saved', or the error that the export could not be made with. */
  function face(now: 'export' | 'saved' | ErrorName | null): void {
    window.clearTimeout(timer);
    button.classList.toggle('saved', now === 'saved');
    button.classList.toggle('failed', now !== 'export' && now !== 'saved');
    const sign = now === 'export' ? glyph(EXPORT.save, 20, '↓') : now === 'saved' ? glyph(EXPORT.saved, 20, '✓') : drawMark('blocked');
    button.replaceChildren(sign, html('span', '', now === 'export' ? 'Export' : now === 'saved' ? 'Saved' : (now ?? 'Export')));
  }
  /** Gives the button back its first face. */
  const resetExport = (): void => {
    if (!button.classList.contains('saved') && !button.classList.contains('failed')) return;
    face('export');
  };
  face('export');

  /** Saves a file the way a link to it with `download` does. */
  function saveFile(file: File): void {
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(file);
    const a = html('a', '');
    a.href = url;
    a.download = file.name;
    a.click();
  }

  button.addEventListener('click', async () => {
    if (busy || !ctx.shown) return;
    busy = true;
    try {
      const file = await make(ctx.shown, { private: ctx.withPrivate });
      if (off.signal.aborted) return;
      saveFile(file);
      // a popup closed while the export was made opens again on 'Export'
      if (popup.hidden) return;
      face('saved');
      timer = window.setTimeout(() => face('export'), SAVED_MS);
    } catch (e) {
      if (off.signal.aborted) return;
      // a roadmap the export cannot take shows its error by name; anything else is a fault of the page, which the console tells
      if (!(e instanceof RoadmapError)) console.error('Roadmapper: the export was not made.', e);
      if (!popup.hidden) face(e instanceof RoadmapError ? e.error : null);
    } finally {
      busy = false;
    }
  });
  keepPrivate.addEventListener('click', () => {
    ctx.withPrivate = !ctx.withPrivate;
    ctx.controls();
    resetExport();
    ctx.save();
  });
  off.signal.addEventListener('abort', () => {
    window.clearTimeout(timer);
    if (url) URL.revokeObjectURL(url);
  });

  return { resetExport };
}

export type ExportPart = ReturnType<typeof exportPart>;
