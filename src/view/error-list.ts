// The error list: a broken file shows every error in place of the plan. The last good drawing stays under it, as it was.
import type { FileError } from '../roadmap/errors.js';
import type { ViewContext } from './context.js';
import { html } from './dom.js';
import { drawMark } from './mark.js';

export function errorListPart(ctx: ViewContext) {
  const { errorList, host, tip } = ctx;

  /** Shows the errors of a broken file in place of the plan: the title of the roadmap, where the file has one, the file, how many errors,
   * and a row for each, as its line, where, key, error and value. */
  function list(errors: FileError[], file?: string, title?: string): void {
    const top = html('header', 'head');
    if (title) top.append(html('h1', 'title', title));
    const bar = html('div', 'bar'), mark = drawMark('blocked');
    mark.setAttribute('width', '26');
    mark.setAttribute('height', '26');
    bar.append(mark);
    if (file) bar.append(html('h2', 'file', file));
    bar.append(html('span', 'howmany', `${errors.length} ${errors.length === 1 ? 'error' : 'errors'}`));
    const table = html('div', 'list');
    table.setAttribute('role', 'table');
    const row = (cls: string, role: string, cells: (string | Node)[]): HTMLElement => {
      const r = html('div', cls);
      r.setAttribute('role', 'row');
      for (const c of cells) {
        const cell = typeof c === 'string' ? html('span', '', c) : (c as HTMLElement);
        cell.setAttribute('role', role);
        r.append(cell);
      }
      return r;
    };
    const code = (cls: string, text: string): HTMLElement => {
      const cell = html('span', cls);
      if (text) cell.append(html('code', '', text));
      return cell;
    };
    table.append(row('row cols', 'columnheader', [html('span', 'ln', 'Line'), 'Where', 'Key', 'Error', 'Value']));
    for (const e of errors) {
      // the path to the piece: the last part in bold, whole, and what it is in before it, cut short where there is no room
      const where = html('span', 'where'), parts = e.path ? e.path.split(' › ') : [], up = html('span', 'up');
      parts.slice(0, -1).forEach((p, i) => up.append(...(i ? [html('span', 'sep', '›'), p] : [p])));
      if (parts.length > 1) where.append(up, html('span', 'sep', '›'));
      if (parts.length) where.append(html('b', '', parts[parts.length - 1]));
      table.append(row('row', 'cell', [html('span', 'ln', e.line ? String(e.line) : ''), where, code('field', e.key), html('span', 'what', e.error), code('val', e.value)]));
    }
    const wrap = html('div', 'wrap');
    wrap.append(bar, table);
    errorList.replaceChildren(top, wrap);
    errorList.scrollTop = 0;
    errorList.hidden = false;
    host.classList.add('broken');
    tip.hidden = true;
  }

  return { list };
}

export type ErrorListPart = ReturnType<typeof errorListPart>;
