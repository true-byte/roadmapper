// What the specs share: the built pages, ways to open and drive them, and the parts of the view to look at.
// npm test builds the pages and the lib first. No server: the pages open from disk.
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import type { Roadmap } from '../src/roadmap/types';

/** The app page, with his roadmap as tests/roadmapper.json keeps it: `npm run build:tests`. */
export const APP = new URL('../dist/tests/app/index.html', import.meta.url).href;
/** The test page, with the plan a test gives: `npm run build:tests`. */
export const PAGE = new URL('../dist/tests/page/index.html', import.meta.url).href;
/** The page of a made-up React app, with <Roadmap> in a box between its own parts and under its own CSS: `npm run build:tests`. */
export const EMBED = new URL('../dist/tests/embed/index.html', import.meta.url).href;
/** A page with no bundler, with two <roadmapper-view> tags and the lib as one plain script: `npm run build:lib`. */
export const PLAIN = new URL('./embed/plain.html', import.meta.url).href;
/** The name the app page keeps its level, its view and its place under. */
export const APP_STORE = 'roadmapper.app';
/** The name the test page keeps them under, unless a test says otherwise. */
export const STORE = 'roadmapper.test';

/** What a view keeps in localStorage. */
export interface Kept {
  level: number;
  /** Is the level the last one, 'Every step'? */
  last?: boolean;
  icons?: boolean;
  /** Are the labels shown? Not there in what an older page kept: that page opens with them shown. */
  labels?: boolean;
  /** The layout the user picked, 'h' across or 'v' down; null until a pick, while the size of the view picks it. */
  flow?: 'h' | 'v' | null;
  /** The scale against reading size. */
  scale?: number;
  /** The top-level branches the user showed or hid against what they get by default, by their tags: the name, or the place, as '#2', where the name is not unique. */
  branches?: Record<string, boolean>;
  /** Is the zoom control hidden down to its grip? */
  tucked?: boolean;
  id: string;
  fx: number;
  fy: number;
}

/** How big a step's name is on the screen at reading size, in px: 13 × 1.2. */
export const READ_PX = 15.6;
/** How big a step's name is on the screen right now, in px: its font size times the scale the plan is drawn at. */
export const nameSize = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('svg.plan')!, label = svg.querySelector('text.label')!;
    return (parseFloat(getComputedStyle(label).fontSize) * svg.getBoundingClientRect().width) / svg.viewBox.baseVal.width;
  });

/** Playwright's test, where a test fails on any script error or console error on the page. `errors` lists them; empty it to allow one. */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      // the app page asks for its fonts, and the tests run offline
      page.on('console', m => {
        if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
      });
      await use(errors);
      expect(errors, 'errors on the page').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export interface Open {
  /** The end of the address, such as 'z=1.5' or '#u=0.5': it holds the page still at that point. */
  hash?: string;
  /** What localStorage holds under the page's store before the page starts: an object is written as JSON, a text as it is. Only on the first load of this tab. */
  kept?: unknown;
  /** Motion: every move plays as it does for a user. Without it, the tests run with reduced motion, and every move ends in one frame. */
  motion?: boolean;
  /** Playwright's clock on the page, put in before the page starts. It keeps the real time until stopClock(). */
  clock?: boolean;
}

/** Opens the test page on a plan, an object or the text of a file. `store` is the name it keeps its level, view and place under; null keeps nothing. */
export async function openPlan(page: Page, plan: Roadmap | string, o: Open & { store?: string | null } = {}): Promise<void> {
  const store = o.store === undefined ? STORE : o.store;
  const q = new URLSearchParams({ plan: typeof plan === 'string' ? plan : JSON.stringify(plan) });
  if (store) q.set('store', store);
  await open(page, `${PAGE}?${q}`, store, o);
}

/** Opens the app page, with his roadmap. */
export async function openApp(page: Page, o: Open = {}): Promise<void> {
  await open(page, APP, APP_STORE, o);
}

async function open(page: Page, url: string, store: string | null, o: Open): Promise<void> {
  if (o.motion) await page.emulateMedia({ reducedMotion: 'no-preference' });
  if (o.clock) await page.clock.install();
  if (o.kept !== undefined) {
    if (!store) throw new Error('kept needs a store');
    const value = typeof o.kept === 'string' ? o.kept : JSON.stringify(o.kept), once = `seeded ${Math.random()}`;
    await page.addInitScript(([store, value, once]) => {
      if (sessionStorage.getItem(once)) return;
      sessionStorage.setItem(once, '1');
      localStorage.setItem(store, value);
    }, [store, value, once]);
  }
  await page.goto(o.hash ? `${url}#${o.hash.replace(/^#/, '')}` : url);
  // drawn, or else the error list says why not
  await page.waitForFunction(() => !!document.querySelector('.roadmap .head .title') || document.querySelector<HTMLElement>('.roadmap .errors')?.hidden === false);
  await settle(page);
}

/** Opens the page of the React app with a roadmap in a box: a plan, an object or the text of a file, or the address of a file in `src`.
 * With neither, the page opens with no box, until window.remount(). */
export async function openEmbed(page: Page, o: { plan?: Roadmap | string; src?: string } = {}): Promise<void> {
  const q = new URLSearchParams();
  if (o.plan !== undefined) q.set('plan', typeof o.plan === 'string' ? o.plan : JSON.stringify(o.plan));
  if (o.src !== undefined) q.set('src', o.src);
  await page.goto(`${EMBED}?${q}`);
  if (q.size) await boxesDrawn(page);
}

/** Waits until each box on the page has drawn, or its error list says why not, and is at rest. */
export async function boxesDrawn(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const boxes = [...document.querySelectorAll('roadmapper-view')];
    return !!boxes.length && boxes.every(b => !!b.shadowRoot?.querySelector('.roadmap .head .title') || b.shadowRoot?.querySelector<HTMLElement>('.roadmap .errors')?.hidden === false);
  });
  await settle(page);
}

/** Loads the page again, as a new visit does, and waits for the view to rest. What `kept` wrote is not written again. */
export async function reload(page: Page): Promise<void> {
  await page.reload();
  await settle(page);
}

/** Draws a new text on the test page, as a save of the file does, and waits for the view to rest. An object is written as JSON. */
export async function save(page: Page, plan: Roadmap | string): Promise<void> {
  const text = typeof plan === 'string' ? plan : JSON.stringify(plan, null, 2);
  await page.evaluate(t => window.view.show(t), text);
  await settle(page);
}

/** Waits until each view on the page is at rest: its host has no data-moving, which the view sets while a move, a change of view, a scale or a smooth scroll
 * is on its way, and the knob of the zoom control is at the level asked for. It looks two frames on, once what the last step set off has begun:
 * a new size of the window, which the view hears of in the next frame.
 * The check runs once a frame; it is not async, since waitForFunction takes a promise for a yes. */
export async function settle(page: Page): Promise<void> {
  await page.waitForFunction(call => {
    const w = window as unknown as { rest?: { call: number; frames: number } };
    if (w.rest?.call !== call) w.rest = { call, frames: 0 };
    // the first look is at once, the next ones a frame apart
    if (++w.rest.frames < 3) return false;
    // the view of the page, or the view in the shadow root of each box on it
    const roots = [document, ...[...document.querySelectorAll('roadmapper-view')].flatMap(b => (b.shadowRoot ? [b.shadowRoot] : []))];
    const hosts = roots.flatMap(r => [...r.querySelectorAll('.roadmap')]);
    if (!hosts.length || hosts.some(h => h.hasAttribute('data-moving'))) return false;
    // a page held still by its address has its knob between two stops
    if (/[#&][zu]=/.test(location.hash)) return true;
    return hosts.every(host => {
      const knob = host.querySelector<HTMLElement>('.zoom .knob');
      const stops = [...host.querySelectorAll('.zoom .stop')], k = stops.findIndex(s => s.getAttribute('aria-current') === 'true');
      return k < 0 || Math.abs(parseFloat(knob?.style.left ?? '') - ((k + 0.5) / stops.length) * 100) < 0.01;
    });
  }, Math.random(), { polling: 'raf' });
}

/** Stops the clock of a page opened with `clock`: from here on, time on the page moves only by play(). Playwright's own waits keep the real time.
 * The page's clock keeps the real time until then, so it stops a second on from now: a time it has not passed yet, however busy the machine is. */
export async function stopClock(page: Page): Promise<void> {
  await page.clock.pauseAt(Date.now() + 1000);
}
/** Moves a stopped clock on by `ms` in one jump: each frame and timer due by then runs once, at the new time, so a move with motion, or a look that lasts 3 s, ends in no time.
 * Then waits for the view to rest. */
export async function play(page: Page, ms: number): Promise<void> {
  await page.clock.fastForward(ms);
  await settle(page);
}

/** The name of the level asked for: the stop of the zoom control that is current. */
export const level = (page: Page): Promise<string> => page.locator('.zoom .stop[aria-current="true"]').innerText();
/** The names of the stops of the zoom control, from far to close. */
export const levels = (page: Page): Promise<string[]> => page.locator('.zoom .stop').allInnerTexts();
/** Clicks the stop of a level and waits for the view to rest there. */
export async function zoomTo(page: Page, name: string): Promise<void> {
  await page.locator('.zoom').getByRole('button', { name, exact: true }).click();
  await settle(page);
}

/** What the page keeps under a store, parsed, or null. */
export const stored = (page: Page, store = STORE): Promise<Kept | null> =>
  page.evaluate(s => JSON.parse(localStorage.getItem(s) ?? 'null') as Kept | null, store);

const xq = (s: string): string => (s.includes('"') ? `'${s}'` : `"${s}"`);
const hasClass = (c: string): string => `contains(concat(" ", normalize-space(@class), " "), " ${c} ")`;

/** Which of these steps are drawn right now, as toBeVisible() tells: a box that is not empty, and not hidden by the theme. All are looked at at once, in the page. */
export const drawnSteps = (page: Page, ids: string[]): Promise<string[]> =>
  page.evaluate(ids => ids.filter(id => {
    const e = document.querySelector(`svg.plan g.zn[data-id="${id}"]`), r = e?.getBoundingClientRect();
    return !!e && !!r && r.width > 0 && r.height > 0 && e.checkVisibility({ visibilityProperty: true });
  }), ids);

/** A step on the plan, by its id: its mark, icon or coin. Hidden where it is not drawn at this level. */
export const step = (page: Page, id: string): Locator => page.locator(`svg.plan g.zn[data-id="${id}"]`);
/** The CSS of the lines of the names in the layout the plan is drawn in, with `more` on each line, such as '[data-id="a"]'.
 * Each name has its lines for both layouts: across over its step, and down right of it, as class 'down'. Those of the other layout are not drawn. */
export const labels = (more = ''): string =>
  `.roadmap[data-flow="h"] svg.plan text.label:not(.down)${more}, .roadmap[data-flow="v"] svg.plan text.label.down${more}`;
/** The lines of the name of a step, by its id. */
export const nameOf = (page: Page, id: string): Locator => page.locator(labels(`[data-id="${id}"]`));
/** The layout the plan is drawn in: 'h' across, 'v' down. */
export const flowOf = (page: Page): Promise<string | null> => page.locator('.roadmap').first().getAttribute('data-flow');
/** The button at the end of the zoom control that opens the popup with the key, the switches 'Hide node icons' and 'Hide labels', and the pair of layouts. */
export const keyButton = (page: Page): Locator => page.locator('.zoom').getByRole('button', { name: 'Key', exact: true });
/** The popup that the button opens, found also while it is shut. */
export const popup = (page: Page): Locator => page.getByRole('dialog', { name: 'Key', includeHidden: true });
/** The switch 'Hide node icons' in the popup, found also while the popup is shut. A plan with no icons has it hidden. */
export const iconsSwitch = (page: Page): Locator => popup(page).getByRole('switch', { name: 'Hide node icons', includeHidden: true });
/** The switch 'Hide labels' in the popup, found also while the popup is shut. Every plan has it. */
export const labelsSwitch = (page: Page): Locator => popup(page).getByRole('switch', { name: 'Hide labels', includeHidden: true });
/** Opens the popup with a click on its button, if it is not open. */
export async function openKey(page: Page): Promise<void> {
  if (await popup(page).isHidden()) await keyButton(page).click();
  await expect(popup(page)).toBeVisible();
}
/** Draws the plan in a layout with the pair in the popup: 'Horizontal' or 'Vertical'. The popup stays open. Waits for the view to rest. */
export async function pickLayout(page: Page, name: 'Horizontal' | 'Vertical'): Promise<void> {
  await openKey(page);
  await popup(page).getByRole('radio', { name }).click();
  await settle(page);
}
/** Shows the labels or hides them with the switch in the popup, where they are not so yet. The popup stays open. Waits for the view to rest. */
export async function showLabels(page: Page, shown: boolean): Promise<void> {
  await openKey(page);
  if ((await labelsSwitch(page).getAttribute('aria-checked')) === String(shown)) await labelsSwitch(page).click();
  await settle(page);
  await expect(labelsSwitch(page)).toHaveAttribute('aria-checked', String(!shown));
}
/** The words the plan draws right now, in the order of the page: each text that shows, and is not faded out. */
export const words = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const svg = document.querySelector('svg.plan')!;
    const seen = (e: Element): boolean => {
      for (let x: Element | null = e; x && x !== svg; x = x.parentElement) if (getComputedStyle(x).display === 'none' || Number(x.getAttribute('opacity') ?? 1) < 0.01) return false;
      return true;
    };
    return [...svg.querySelectorAll('text')].filter(t => !!t.textContent && seen(t)).map(t => t.textContent!);
  });

/** A group drawn as one step, at 'Main steps', by its name: a name on one line, or the name of a group the plan names, which its frame holds whole. */
export const group = (page: Page, name: string): Locator =>
  page.locator(`xpath=//*[local-name()="g"][${hasClass('zn')}][@data-pod=//*[local-name()="text"][${hasClass('label')} or ${hasClass('gname')}][.=${xq(name)}]/@data-pod]`);
/** The pill of a closed track, by the name of the track: the mark of its state and a count such as 1/4. */
export const pill = (page: Page, track: string): Locator =>
  page.locator(`xpath=//*[local-name()="g"][${hasClass('tally')}][@data-bar=//*[local-name()="text"][${hasClass('cap')}][.=${xq(track)}]/@data-bar]`);
/** The caption of a branch, by its name. It answers the pointer for the branch. */
export const caption = (page: Page, branch: string): Locator =>
  page.locator(`xpath=//*[local-name()="text"][${hasClass('cap')}][.=${xq(branch)}]`);

/** The tip that a hover shows. */
export const tip = (page: Page): Locator => page.locator('.roadmap .tip');
/** The side bar that a click shows. */
export const side = (page: Page): Locator => page.locator('.roadmap .side');
/** The error list of a broken file. */
export const errorList = (page: Page): Locator => page.locator('.roadmap .errors');
/** Each row of the error list, as its line, where, key, error and value, two spaces apart, as `npm run validate` prints them after the file. */
export const errorRows = (page: Page): Promise<string[]> =>
  errorList(page).locator('.row:not(.cols)').evaluateAll(rows => rows.map(r => [...r.children].map(c => (c.textContent ?? '').replace(/›/g, ' › ')).join('  ')));
