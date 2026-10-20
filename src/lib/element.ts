// The tag another page writes to show a roadmap: <roadmapper-view>. It is the view in a box on that page.
// Its look lives in a shadow root, so nothing of the page gets in and nothing of the view gets out. The page sets only its size, with its own CSS.
// The roadmap comes in as data: the `roadmap` property (the object of a roadmap file, or its text), a `src` address to read it from,
// or the text of the file in a <script type="application/json"> inside the tag. The box keeps nothing: each visit starts at the first level.
// With the attribute `page`, the tag is the whole page, as the app is: the HTML export. Then the wheel and the keys are the view's, with no click first.
// The icons come from a <script type="application/json" data-icons> inside the tag, when the page holds them, or else from a set the lib loads,
// or else, for the export's lib, which holds no set, from the file at src, which the export writes with the icons it names.
// the view's own CSS, then the theme's variables: the theme comes last, so its color-scheme wins over the view's `all: initial`
import viewCss from '../view/view.css?inline';
import themeCss from '../themes/theme.css?inline';
import { iconSet, useIconSet, type IconSet } from '../icons/icons.js';
import type { Roadmap } from '../roadmap/types.js';
import { SVG_NS } from '../view/svg.js';
import { mountRoadmap, type RoadmapView } from '../view/view.js';

/** A roadmap as the box takes it: the object of a roadmap file, or its text. A file read as JSON, whose states are only texts to the type checker, goes too: the box checks it when it draws. */
export type RoadmapInput = Roadmap | string | Record<string, unknown>;

export interface RoadmapperView extends HTMLElement {
  /** The roadmap to show. */
  roadmap: RoadmapInput | undefined;
}

/** The icons a page holds inside the tag: the drawings a roadmap names, of the set its theme names, with the license of the set. */
export interface OwnIcons {
  set: string;
  size: number;
  license: string;
  icons: Record<string, string>;
}

/** Makes <roadmapper-view> known to the page, with the icon sets it may load by name. Once is enough; a second call, or a second copy of the lib, does nothing.
 * Off a browser, as on a server, it does nothing. */
export function defineRoadmapper(loads: Record<string, () => Promise<IconSet>> = {}): void {
  if (typeof window === 'undefined' || !window.customElements || customElements.get('roadmapper-view')) return;
  let sheet: CSSStyleSheet | undefined;

  class View extends HTMLElement implements RoadmapperView {
    static observedAttributes = ['src'];
    #view: RoadmapView | null = null;
    #data: RoadmapInput | undefined;
    /** The text last given to the view: the same text again is not drawn again. */
    #text: string | undefined;
    /** The name of the file the roadmap came from, for the error list: the last part of src. None for a roadmap given in the page. */
    #file: string | undefined;
    #fetching: AbortController | null = null;
    #root = this.attachShadow({ mode: 'open' });
    /** Did the page name the box itself, when it first put it on? Then its name stays. */
    #named: boolean | undefined;
    /** The name of the icon set, when the view takes its icons from the files it reads at src: in a lib with no set, as the export's. */
    #fromFile: string | undefined;
    /** The icons of the file the view was made with, as text. A file with other icons makes the view again. */
    #fileArt: string | undefined;

    constructor() {
      super();
      // a page that set the roadmap before the tag was known set it on the element itself, where it would hide this class's own
      if (Object.hasOwn(this, 'roadmap')) {
        const early = (this as { roadmap?: RoadmapInput }).roadmap;
        delete (this as { roadmap?: unknown }).roadmap;
        this.roadmap = early;
      }
      // a control that goes away under the pointer or a key, like × or Escape on it, takes the focus with it: the box takes it back, and the page does not move
      const keep = (): void => {
        setTimeout(() => {
          const at = this.#root.activeElement as HTMLElement | null;
          if (this.isConnected && (document.activeElement === document.body || (at?.checkVisibility && !at.checkVisibility()))) this.focus({ preventScroll: true });
        });
      };
      this.#root.addEventListener('click', keep);
      this.#root.addEventListener('keydown', keep);
    }

    get roadmap(): RoadmapInput | undefined {
      return this.#data;
    }
    set roadmap(value: RoadmapInput | undefined) {
      this.#fetching?.abort();
      this.#data = value;
      this.#file = undefined;
      this.#draw();
    }

    /** Draws the roadmap, unless the view already shows that very text: a page that draws itself again with the same roadmap leaves the box as it is. */
    #draw(): void {
      const text = this.#data === undefined || typeof this.#data === 'string' ? this.#data : JSON.stringify(this.#data);
      if (text === undefined || !this.#view || text === this.#text) return;
      this.#text = text;
      this.#view.show(text, this.#file);
    }

    connectedCallback(): void {
      const page = this.hasAttribute('page');
      // in a box, keys go to the view only while the box has the focus; a click in the box gives it the focus
      if (!page && !this.hasAttribute('tabindex')) this.tabIndex = 0;
      if (!this.hasAttribute('role')) this.setAttribute('role', 'region');
      this.#named ??= this.hasAttribute('aria-label');
      if (!this.hasAttribute('aria-label')) this.setAttribute('aria-label', 'Roadmap');
      if (this.#view || this.#root.childElementCount) return;
      sheet ??= new CSSStyleSheet();
      if (!sheet.cssRules.length) sheet.replaceSync(viewCss + themeCss);
      this.#root.adoptedStyleSheets = [sheet];
      const inner = document.createElement('div');
      inner.className = page ? 'roadmap page' : 'roadmap box';
      // until the view is made, what the page wrote inside the tag shows, such as the export's 'Loading the roadmap…'
      this.#root.append(document.createElement('slot'), inner);
      void this.#start(inner, page);
    }

    async #start(inner: HTMLElement, page: boolean): Promise<void> {
      // the icons are there before the first draw, so the steps never jump from marks to icons: the icons the page holds inside the tag,
      // which can come after the tag, for this view only, or else the set the theme names, which the lib loads once for the page
      const name = getComputedStyle(inner).getPropertyValue('--icon-set').trim();
      if (name) await parsed();
      let own = name ? this.#ownIcons(name) : undefined;
      // or else, in a lib with no set, as the export's, the icons in the file at src, which the export writes with the icons it names.
      // That file is read before the view is made, and a src that changes meanwhile is read in its place.
      if (name && !own && !iconSet(name) && !Object.hasOwn(loads, name)) this.#fromFile = name;
      let got: Got | undefined;
      for (let src = this.getAttribute('src'); this.#fromFile && this.#data === undefined && src; src = this.getAttribute('src')) {
        got = await this.#fetch(src);
        if (!got || this.getAttribute('src') === src) break;
      }
      if (got?.text !== undefined) own = this.#iconsOf(got.text);
      if (name && !own && !iconSet(name) && Object.hasOwn(loads, name)) {
        try {
          useIconSet(name, await loads[name]());
        } catch (e) {
          console.error('Roadmapper: the icon set did not load, so the steps keep their marks.', e);
        }
      }
      if (!inner.isConnected) return;
      this.#mount(inner, page, own);
      if (this.#data !== undefined) this.#draw();
      else if (got && got.src === this.getAttribute('src')) this.#take(got);
      else if (this.getAttribute('src')) this.#read();
      else this.#inside();
    }

    /** Makes the view in `inner`, with these icons. */
    #mount(inner: HTMLElement, page: boolean, icons: IconSet | undefined): void {
      this.#root.querySelector('slot')?.remove();
      this.#view = mountRoadmap(inner, {
        box: page ? undefined : this,
        icons,
        onDraw: roadmap => {
          if (!this.#named) this.setAttribute('aria-label', `Roadmap: ${roadmap.title}`);
          // the whole page is the roadmap: a new title in the file is the page's title too
          if (page) document.title = `${roadmap.title} · roadmap`;
        },
      });
    }

    /** The icons of a file read at src, for a view that takes its icons from its files. They are kept as text, to tell them from the next file's. */
    #iconsOf(text: string): IconSet | undefined {
      const { set, key } = fileIcons(text, this.#fromFile!);
      this.#fileArt = key;
      return set;
    }

    /** The text of the file in a <script type="application/json"> inside the tag: read once the page is all there, as the tag can come before what it holds. */
    #inside(): void {
      void parsed().then(() => {
        const text = this.querySelector('script[type="application/json"]:not([data-icons])')?.textContent;
        if (text != null && this.#data === undefined) this.roadmap = text;
      });
    }

    /** The icons of the set `name` that the page holds inside the tag, if it holds any. */
    #ownIcons(name: string): IconSet | undefined {
      const text = this.querySelector('script[type="application/json"][data-icons]')?.textContent;
      if (!text) return undefined;
      try {
        return asIconSet(JSON.parse(text), name);
      } catch (e) {
        console.error('Roadmapper: the icons in the page are broken, so the steps keep their marks.', e);
        return undefined;
      }
    }

    attributeChangedCallback(_name: string, was: string | null, now: string | null): void {
      if (now && now !== was && this.#view) this.#read();
    }

    /** Reads the roadmap from the address in src, and draws it. */
    #read(): void {
      const src = this.getAttribute('src');
      if (!src) return;
      void this.#fetch(src).then(got => {
        if (got) this.#take(got);
      });
    }

    /** Draws what came from src. A file that did not come shows on the error list, and the last good drawing stays under it. */
    #take(got: Got): void {
      if (got.text === undefined) {
        this.#view?.fail({ line: 0, path: '', key: '', error: 'Unreadable file', value: got.src }, fileName(got.src));
        return;
      }
      this.#data = got.text;
      this.#file = fileName(got.src);
      // a view that takes its icons from its files is made again for a file with other icons, at its first level, as a new visit is
      if (this.#fromFile && this.#view && fileIcons(got.text, this.#fromFile).key !== this.#fileArt) {
        const page = this.hasAttribute('page');
        const inner = document.createElement('div');
        inner.className = page ? 'roadmap page' : 'roadmap box';
        this.#view.destroy();
        this.#text = undefined;
        this.#root.replaceChildren(inner);
        this.#mount(inner, page, this.#iconsOf(got.text));
      }
      this.#draw();
    }

    /** Gets the file at `src`: its text, or no text when it did not come. Nothing, when a newer read or a roadmap given since took its place. */
    async #fetch(src: string): Promise<Got | undefined> {
      this.#fetching?.abort();
      const fetching = (this.#fetching = new AbortController());
      try {
        // the browser asks the host each time whether the file is new, so a new roadmap shows on the next visit
        const r = await fetch(src, { signal: fetching.signal, cache: 'no-cache' });
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        const text = await r.text();
        return fetching.signal.aborted ? undefined : { src, text };
      } catch (e) {
        if (fetching.signal.aborted) return undefined;
        console.error(`Roadmapper: the roadmap at ${src} did not come.`, e);
        return { src };
      }
    }

    disconnectedCallback(): void {
      // a box that is only moved on the page comes back at once, and keeps its view
      queueMicrotask(() => {
        if (this.isConnected) return;
        this.#fetching?.abort();
        this.#view?.destroy();
        this.#view = null;
        this.#text = undefined;
        this.#root.replaceChildren();
      });
    }
  }

  customElements.define('roadmapper-view', View);
}

/** The name of the file at an address: its last part. */
const fileName = (src: string): string => src.split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? src;

/** What came from a src: the text of the file, or none when it did not come. */
interface Got {
  src: string;
  text?: string;
}

/** Icons of the set `name`, as a page or a file holds them, read as a set. None when they are of another set or not icons at all. */
function asIconSet(v: unknown, name: string): IconSet | undefined {
  const own = (typeof v === 'object' && v ? v : {}) as Partial<OwnIcons>;
  if (own.set !== name || !own.icons || typeof own.icons !== 'object') return undefined;
  const icons = own.icons;
  return {
    size: typeof own.size === 'number' ? own.size : 24,
    art: n => (Object.hasOwn(icons, n) && typeof icons[n] === 'string' ? icons[n] : undefined),
    license: typeof own.license === 'string' ? own.license : '',
  };
}

/** The icons of the set `name` that a roadmap file holds under `icons`, as the export writes them, and those icons as text, to tell one file's from another's.
 * A file is data, so only an icon that is a plain drawing is taken; any other keeps its mark. A broken file has none: the view says what is wrong with it. */
function fileIcons(text: string, name: string): { set?: IconSet; key: string } {
  let raw: unknown;
  try {
    raw = (JSON.parse(text) as { icons?: unknown } | null)?.icons;
  } catch {
    return { key: '' };
  }
  const set = asIconSet(raw, name);
  const checked = new Map<string, string | undefined>();
  const art = (n: string): string | undefined => {
    if (!checked.has(n)) {
      const a = set?.art(n);
      checked.set(n, a !== undefined && plain(a) ? a : undefined);
    }
    return checked.get(n);
  };
  return { set: set && { ...set, art }, key: JSON.stringify(raw ?? null) };
}

/** What a plain drawing is made of: shapes, and the keys that say how they are drawn. A link may point only inside the drawing. */
const SHAPES = new Set(['g', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect', 'defs', 'use']);
const DRAWS = /^(?:d|points|cx|cy|r|rx|ry|x|y|x1|y1|x2|y2|width|height|transform|fill|fill-rule|fill-opacity|clip-rule|stroke|stroke-width|stroke-linecap|stroke-linejoin|stroke-miterlimit|stroke-dasharray|stroke-dashoffset|stroke-opacity|opacity|id|class)$/;

/** Is this SVG markup a plain drawing, with nothing that can run or load: no script, no handler, no text, no link out? */
function plain(art: string): boolean {
  const doc = new DOMParser().parseFromString(`<svg xmlns="${SVG_NS}">${art}</svg>`, 'image/svg+xml');
  if (doc.getElementsByTagName('parsererror').length) return false;
  const ok = (e: Element): boolean =>
    [...e.childNodes].every(c => {
      if (c.nodeType === Node.TEXT_NODE) return !c.textContent?.trim();
      if (!(c instanceof Element) || c.namespaceURI !== SVG_NS || !SHAPES.has(c.localName)) return false;
      return [...c.attributes].every(a => (!a.namespaceURI && DRAWS.test(a.name)) || (a.name === 'href' && a.value.startsWith('#'))) && ok(c);
    });
  return ok(doc.documentElement);
}

/** Resolves once the page is all there, so what a tag holds can be read. */
const parsed = (): Promise<void> =>
  document.readyState === 'loading' ? new Promise(done => document.addEventListener('DOMContentLoaded', () => done(), { once: true })) : Promise.resolve();
