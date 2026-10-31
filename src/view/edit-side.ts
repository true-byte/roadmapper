// The side bar in edit mode: each key of what is picked as a field, which changes the plan as it is typed in or pressed (edit.ts). A field whose text the file check refuses turns red.
// A step: its icon, which opens a grid of the icons of the set with a search; its name; its state as the five marks of the key; 'Milestone' and 'Private' as chips;
// 'Waits for' and 'Links' as rows with a remove button and a '+'; 'Why' and 'Done when' as fields that grow with their text; and the days of 'Planned' and 'Deadline'.
// A branch: its name, 'Private', 'Holds' and 'In it'. A group: its name, 'Private' and 'In it'.
import { ARROW, EDIT, LINKS } from '../icons/icons.js';
import { setBranch, setSplit, setStep, type StepField } from '../roadmap/edit.js';
import { STATE_NAME, type Branch, type Item, type Link, type RoadNode, type Roadmap, type Split, type Written } from '../roadmap/types.js';
import type { ViewContext } from './context.js';
import { html } from './dom.js';
import type { How } from './edit.js';
import { F } from './layout.js';
import { drawMark } from './mark.js';
import { count, isBranch, isKids, isStep, sole, sum, tagOf, type TBranch, type TNode, type TSplit, type Thing } from './plan.js';
import { refOf } from './side.js';
import { SVG_NS, el } from './svg.js';

/** The states a file may say, in the order of the key. */
const WRITTEN: Written[] = ['done', 'in-progress', 'todo', 'canceled', 'tbd'];
/** How many icons the grid shows at once: the search finds the others. */
const GRID_MAX = 96;
/** How many steps the search of 'Waits for' shows. */
const FOUND_MAX = 6;

/** Every step of a roadmap, in the order of the file. */
function stepsOf(r: Roadmap): RoadNode[] {
  const all = (items: Item[]): RoadNode[] => items.flatMap(it => ('split' in it ? it.split.flatMap(b => all(b.items)) : [it]));
  return r.branches.flatMap(b => all(b.items));
}
/** The branch of a roadmap with the view's key, such as 'b0.2.1'. */
function branchIn(r: Roadmap, key: string): Branch | undefined {
  const [top, ...at] = key.slice(1).split('.').map(Number);
  let b: Branch | undefined = r.branches[top];
  for (let i = 0; b && i < at.length; i += 2) {
    const it: Item | undefined = b.items[at[i]];
    b = it && 'split' in it ? it.split[at[i + 1]] : undefined;
  }
  return b;
}
/** The split of a roadmap with the view's key, such as 'b0.2'. */
function splitIn(r: Roadmap, key: string): Split | undefined {
  const k = key.lastIndexOf('.'), it = branchIn(r, key.slice(0, k))?.items[Number(key.slice(k + 1))];
  return it && 'split' in it ? it : undefined;
}

/** The mark of a milestone, as the key draws it: the ring of a step with the milestone's ring around it. */
function milestoneMark(): SVGSVGElement {
  const m = document.createElementNS(SVG_NS, 'svg');
  m.setAttribute('class', 'mark');
  m.setAttribute('viewBox', '-12 -12 24 24');
  m.setAttribute('width', '18'); m.setAttribute('height', '18');
  m.setAttribute('aria-hidden', 'true');
  el(m, 'circle', { class: 'ms', r: F.RING });
  el(el(m, 'g', { class: 'node todo' }), 'circle', { class: 'ring', r: 7 });
  return m;
}

export function editSidePart(ctx: ViewContext) {
  const { art, glyph, ICON_BOX, icons } = ctx;
  /** Each side bar made gets a number of its own: the keys typed in one field of it make one change. */
  let made = 0;

  const part = (name: string, ...body: Node[]): HTMLElement => {
    const s = html('section', 'part');
    s.append(html('h3', '', name), ...body);
    return s;
  };
  /** A small button with an icon and no word: its name is for the browser's tip and a screen reader. */
  const small = (cls: string, icon: string, sign: string, label: string, act: () => void): HTMLButtonElement => {
    const b = html('button', cls);
    b.append(glyph(icon, 16, sign));
    b.title = label;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', act);
    return b;
  };
  /** A field of text: a line, or a box that grows with its text. Each key typed calls `on`; `f` finds it again after the side bar is made again. */
  function field(tag: 'input' | 'textarea', cls: string, value: string, f: string, label: string, on: (v: string, e: HTMLElement) => void): HTMLInputElement | HTMLTextAreaElement {
    const e = document.createElement(tag);
    e.className = `field ${cls}`;
    e.value = value;
    e.dataset.f = f;
    e.spellcheck = false;
    e.setAttribute('aria-label', label);
    const fit = (): void => {
      if (!(e instanceof HTMLTextAreaElement)) return;
      e.style.height = 'auto';
      e.style.height = `${e.scrollHeight + 2}px`;
    };
    if (e instanceof HTMLTextAreaElement) {
      e.rows = 1;
      // its height once it is on the page, where its text has a width to wrap to
      requestAnimationFrame(fit);
    }
    e.addEventListener('input', () => { fit(); on(e.value, e); });
    return e;
  }
  /** A day: empty, or as the file writes it. Each key typed calls `set` once the day is whole, so the side bar stays as it is while the keys come;
   * a day typed in part turns red, and the step keeps its day. */
  function dayField(value: string | undefined, f: string, label: string, set: (v: string | undefined, e: HTMLElement) => void): HTMLInputElement {
    const e = document.createElement('input');
    e.type = 'date';
    e.className = 'field day';
    e.value = value ?? '';
    e.dataset.f = f;
    e.setAttribute('aria-label', label);
    const on = (): void => {
      if (e.validity.badInput) e.classList.add('bad');
      else set(e.value || undefined, e);
    };
    e.addEventListener('input', on);
    e.addEventListener('blur', on);
    return e;
  }
  /** A switch that is a word in a pill, gold while it is on. */
  function chip(word: string, face: Node, on: boolean, flip: () => void): HTMLButtonElement {
    const b = html('button', 'chip');
    b.append(face, html('span', '', word));
    b.setAttribute('aria-pressed', String(on));
    b.addEventListener('click', flip);
    return b;
  }
  /** Picks a thing of the side bar, as the plan has it now: the plan may have been drawn again under the side bar since it was made. */
  const pickNow = (t: Thing): void => ctx.pick(ctx.thingOf(refOf(t)) ?? null);
  /** A step, a branch or a group as a row: a press picks it. */
  function row(t: Thing): HTMLElement {
    const b = html('button', 'row');
    if (isStep(t)) b.append(drawMark(t.state), html('span', t.milestone ? 'strong nm' : 'nm', t.node.name));
    else if (isBranch(t)) b.append(html('span', 'branch nm', t.name ?? 'Branch'), html('span', 'dim', count(t)));
    else b.append(drawMark(sum(t)), html('span', 'nm', t.name), html('span', 'dim', count(t)));
    b.addEventListener('click', () => pickNow(t));
    return b;
  }
  /** A drawing of the icon set, by its name, in a state's color. */
  function face(name: string | undefined, size: number, state: string): SVGElement | undefined {
    const a = name ? art(name) : undefined;
    if (!a) return undefined;
    const e = document.createElementNS(SVG_NS, 'svg');
    e.setAttribute('class', `face ic ${state}`);
    e.setAttribute('viewBox', `0 0 ${ICON_BOX} ${ICON_BOX}`);
    e.setAttribute('width', String(size)); e.setAttribute('height', String(size));
    e.setAttribute('aria-hidden', 'true');
    e.innerHTML = a;
    return e;
  }
  /** The grid of icons: a search, a cell that takes the icon away, and the icons of the set that the search finds; with no search, those the plan names first. */
  function iconGrid(now: string | undefined, choose: (name: string | undefined) => void): HTMLElement {
    const box = html('div', 'icon-grid'), find = html('label', 'find'), q = document.createElement('input'), cells = html('div', 'cells');
    q.type = 'search';
    q.placeholder = 'Search';
    q.setAttribute('aria-label', 'Search');
    find.append(glyph(EDIT.search, 18, ''), q);
    const all = icons?.names?.() ?? [], used = [...new Set(stepsOf(ctx.editNow()!).flatMap(n => (n.icon && art(n.icon) ? [n.icon] : [])))];
    const cell = (name: string | undefined): HTMLButtonElement => {
      const b = small(name === now ? 'on' : '', name ?? EDIT.remove, '×', name ?? 'No icon', () => choose(name));
      b.querySelector('svg')?.setAttribute('width', '20');
      b.querySelector('svg')?.setAttribute('height', '20');
      if (!name) b.classList.add('none');
      return b;
    };
    const fill = (): void => {
      const s = q.value.trim().toLowerCase();
      const names = s ? all.filter(n => n.includes(s)) : [...used, ...all.filter(n => !used.includes(n))];
      cells.replaceChildren(...(s ? [] : [cell(undefined)]), ...names.slice(0, GRID_MAX).map(cell));
    };
    q.addEventListener('input', fill);
    fill();
    box.append(find, cells);
    box.hidden = true;
    return box;
  }
  /** The branches around a thing, the outermost first: a press picks one. */
  function path(t: Thing): HTMLElement | null {
    const nav = html('nav', 'path');
    for (let b: TBranch | undefined = isBranch(t) ? t : t.owner; b; b = b.parent) {
      const around: (TBranch | TSplit)[] = [];
      if (b !== t && !sole(b)) around.push(b);
      if (b.pod?.kids.includes(b)) around.push(b.pod);
      for (const a of around) {
        const c = html('span', 'crumb', a.name ?? 'Branch');
        c.setAttribute('role', 'button');
        c.tabIndex = 0;
        c.addEventListener('click', () => pickNow(a));
        c.addEventListener('keydown', e => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          pickNow(a);
        });
        nav.prepend(c);
      }
    }
    return nav.childElementCount ? nav : null;
  }

  function stepFields(t: TNode, r: Roadmap, serial: number): Node[] {
    const n = stepsOf(r).find(s => s.id === t.node.id);
    if (!n) return [];
    /** The id of the step now: a new step's id follows its name. */
    const me = { id: n.id };
    const set = <K extends StepField>(key: K, value: RoadNode[K], how: How = {}): boolean => {
      const now = ctx.editNow();
      if (!now) return false;
      const e = setStep(now, me.id, key, value, ctx.editOld());
      if (e.ok && e.step) me.id = e.step;
      return ctx.applyEdit(e, how);
    };
    const typed = (key: 'name' | 'why' | 'doneWhen', clean = (v: string): string => v) => (v: string, e: HTMLElement): void => {
      set(key, clean(v), { field: `${serial} ${key}`, el: e, typing: true });
    };

    // the icon, which opens the grid, and the name
    const top = html('div', 'name'), faceB = html('button', 'face-btn');
    faceB.title = 'Icon';
    faceB.setAttribute('aria-label', 'Icon');
    faceB.setAttribute('aria-expanded', 'false');
    faceB.append(face(n.icon, 30, t.state) ?? glyph(EDIT.face, 22, '◌'));
    const grid = iconGrid(n.icon, name => set('icon', name));
    faceB.addEventListener('click', () => {
      grid.hidden = !grid.hidden;
      faceB.setAttribute('aria-expanded', String(!grid.hidden));
      if (!grid.hidden) grid.querySelector('input')?.focus();
    });
    const name = field('textarea', 'h2', n.name, 'name', 'Name', typed('name', v => v.replace(/\s*\n\s*/g, ' ')));
    name.addEventListener('keydown', e => {
      if ((e as KeyboardEvent).key !== 'Enter') return;
      e.preventDefault();
      name.blur();
    });
    top.append(faceB, name);

    // the state, among the marks of the key; then a milestone and private, on or off
    const facts = html('div', 'facts edit-facts'), states = html('div', 'states'), state = n.state ?? 'todo';
    states.setAttribute('role', 'radiogroup');
    states.setAttribute('aria-label', 'State');
    for (const s of WRITTEN) {
      const b = html('button', 'state');
      b.append(drawMark(s));
      b.title = STATE_NAME[s];
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', STATE_NAME[s]);
      b.setAttribute('aria-checked', String(s === state));
      b.addEventListener('click', () => set('state', s));
      states.append(b);
    }
    facts.append(states,
      chip('Milestone', milestoneMark(), n.milestone === true, () => set('milestone', !n.milestone)),
      chip('Private', glyph(n.private ? EDIT.locked : EDIT.open, 15, ''), n.private === true, () => set('private', !n.private)));

    // 'Waits for': a row for each, with its remove; '+' finds a step by its name
    const waits = (n.waitsFor ?? []).map(id => {
      const w = stepsOf(r).find(s => s.id === id), rw = html('div', 'row edit-row');
      rw.append(drawMark(ctx.byId.get(id)?.state ?? w?.state ?? 'todo'), html('span', 'nm grow', w?.name ?? id),
        small('x-btn', EDIT.remove, '×', 'Remove', () => set('waitsFor', n.waitsFor!.filter(x => x !== id))));
      return rw;
    });
    const finder = html('div', 'finder'), findBox = html('label', 'find'), find = document.createElement('input'), found = html('div', 'found');
    finder.hidden = true;
    find.type = 'search';
    find.placeholder = 'Search';
    find.setAttribute('aria-label', 'Search');
    findBox.append(glyph(EDIT.search, 18, ''), find);
    const fill = (): void => {
      const q = find.value.trim().toLowerCase();
      const can = stepsOf(r).filter(s => s.id !== n.id && !(n.waitsFor ?? []).includes(s.id) && s.name.toLowerCase().includes(q)).slice(0, FOUND_MAX);
      found.replaceChildren(...can.map(s => {
        const b = html('button', 'row');
        b.append(drawMark(ctx.byId.get(s.id)?.state ?? s.state ?? 'todo'), html('span', 'nm', s.name));
        b.addEventListener('click', () => set('waitsFor', [...(n.waitsFor ?? []), s.id], { el: find }));
        return b;
      }));
    };
    find.addEventListener('input', () => { find.classList.remove('bad'); fill(); });
    finder.append(findBox, found);
    const addWait = small('add', EDIT.add, '+', 'Add', () => {
      finder.hidden = !finder.hidden;
      if (finder.hidden) return;
      fill();
      find.focus();
    });

    // 'Links': the icon, the name and the address of each, and its remove; '+' adds a row, which joins the plan once it has a name and an address
    const links = n.links ?? [];
    const linkRow = (l: Link | null, i: number): HTMLElement => {
      const rw = html('div', 'row edit-row link-row'), col = html('div', 'grow col');
      const iconB = html('button', 'face-btn small');
      iconB.title = 'Icon';
      iconB.setAttribute('aria-label', 'Icon');
      iconB.append(glyph(l?.icon && art(l.icon) ? l.icon : LINKS.link, 20, '↗'));
      const lname = field('input', 'strong', l?.name ?? '', `link-name-${i}`, 'Name', () => put());
      const url = field('input', 'url', l?.url ?? '', `link-url-${i}`, 'Address', () => put());
      let draft = !l;
      /** The links as the plan has them now: another row may have been typed in since the side bar was made. */
      const cur = (): Link[] => stepsOf(ctx.editNow()!).find(s => s.id === me.id)?.links ?? [];
      /** The link as its fields have it, in the list of links: a new row joins the plan once neither field is empty. A pick of the grid sets its icon, or with none takes it out. */
      function put(icon?: { name?: string }): void {
        if (draft && (!lname.value.trim() || !url.value.trim())) return;
        const now = cur();
        // a new row goes after the links the plan has when it joins
        if (draft) i = now.length;
        const name = icon ? icon.name : now[i]?.icon;
        const one: Link = { name: lname.value, url: url.value.trim(), ...(name ? { icon: name } : {}) };
        const el = !lname.value.trim() ? lname : url;
        if (set('links', [...now.slice(0, i), one, ...now.slice(i + 1)], icon ? {} : { field: `${serial} link ${i}`, el, typing: true })) {
          draft = false;
          lname.classList.remove('bad');
          url.classList.remove('bad');
        }
      }
      const grid = iconGrid(l?.icon, name => { if (!draft) put({ name }); });
      iconB.addEventListener('click', () => { if (!draft) grid.hidden = !grid.hidden; });
      col.append(lname, url, grid);
      rw.append(iconB, col, small('x-btn', EDIT.remove, '×', 'Remove', () => {
        if (draft) rw.remove();
        else set('links', cur().filter((_, j) => j !== i));
      }));
      return rw;
    };
    const linkRows = links.map(linkRow), linksPart = part('Links', ...linkRows);
    const addLink = small('add', EDIT.link, '+', 'Add', () => {
      const rw = linkRow(null, links.length);
      addLink.before(rw);
      rw.querySelector<HTMLElement>('input')?.focus();
    });
    linksPart.append(addLink);

    // 'Planned': its start, then its end; 'Deadline'
    const days = html('div', 'days'), arrow = html('span', 'to');
    arrow.append(glyph(ARROW.right, 16, '→'));
    const day = (key: 'start' | 'end' | 'deadline', label: string): HTMLInputElement => dayField(n[key], key, label, (v, e) => set(key, v, { field: `${serial} ${key}`, el: e, typing: true }));
    days.append(day('start', 'Start'), arrow, day('end', 'End'));

    return [top, grid, facts,
      part('Waits for', ...waits, addWait, finder),
      linksPart,
      part('Why', field('textarea', '', n.why ?? '', 'why', 'Why', typed('why'))),
      part('Done when', field('textarea', '', n.doneWhen ?? '', 'doneWhen', 'Done when', typed('doneWhen'))),
      part('Planned', days),
      part('Deadline', day('deadline', 'Deadline')),
    ];
  }

  /** A branch or a group: its name, private on or off, what a branch holds, and what is in it as rows to pick. */
  function pieceFields(t: TBranch | TSplit, r: Roadmap, serial: number): Node[] {
    const key = t.key, branch = isBranch(t), own: Branch | Split | undefined = branch ? branchIn(r, key) : splitIn(r, key);
    if (!own) return [];
    const set = (k: 'name' | 'holds' | 'private', v: string | boolean, how: How = {}): boolean => {
      const now = ctx.editNow();
      if (!now) return false;
      const e = branch ? setBranch(now, key, k, v) : setSplit(now, key, k as 'name' | 'private', v);
      // a top-level branch stays shown or hidden under its new name, as it is kept under its name
      const was = branch && k === 'name' && e.ok ? ctx.plan?.every.find(x => x.top.key === key) : undefined;
      if (was && e.ok) ctx.choices.set(tagOf(e.roadmap, e.roadmap.branches.indexOf(branchIn(e.roadmap, key)!)), was.shown);
      return ctx.applyEdit(e, { ...how, pick: { key } });
    };
    const top = html('div', branch ? 'name branch' : 'name');
    const name = field('textarea', branch ? 'h2 branch' : 'h2', own.name ?? '', 'name', 'Name', (v, e) => set('name', v.replace(/\s*\n\s*/g, ' '), { field: `${serial} name`, el: e, typing: true }));
    // a group with no name of its own shows the name the plan gives it
    if (!branch && !own.name) name.placeholder = t.name;
    name.addEventListener('keydown', e => {
      if ((e as KeyboardEvent).key !== 'Enter') return;
      e.preventDefault();
      name.blur();
    });
    top.append(name);
    const facts = html('div', 'facts edit-facts');
    facts.append(chip('Private', glyph(own.private ? EDIT.locked : EDIT.open, 15, ''), own.private === true, () => set('private', !own.private)));
    const out: Node[] = [top, facts];
    if (branch) out.push(part('Holds', field('textarea', '', (own as Branch).holds ?? '', 'holds', 'Holds', (v, e) => set('holds', v, { field: `${serial} holds`, el: e, typing: true }))));
    const inIt = (b: TBranch): Thing[] => b.items.flatMap((it): Thing[] => (isKids(it) && !ctx.byPod.has(it.key) ? it.kids : [it]));
    const kids = branch ? inIt(t) : sole(t.kids[0]) ? inIt(t.kids[0]) : t.kids;
    out.push(part('In it', ...kids.map(row)));
    return out;
  }

  /** The side bar of a thing in edit mode. */
  function editSide(t: Thing): Node[] {
    const r = ctx.editNow();
    const close = html('button', 'close', '×');
    close.title = 'Close (Esc)';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => ctx.pick(null));
    const out: Node[] = [close];
    if (!r) return out;
    const p = path(t);
    if (p) out.push(p);
    const serial = ++made;
    out.push(...(isStep(t) ? stepFields(t, r, serial) : pieceFields(t, r, serial)));
    return out;
  }

  return { editSide };
}

export type EditSidePart = ReturnType<typeof editSidePart>;
