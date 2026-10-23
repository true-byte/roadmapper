// Long text: the tree and the rows cut a long text, and the tip and the side bar show all of it. Nothing scrolls sideways, on the page or in the side bar.
// On the tree, the name of a branch and the name of a group are one line each, cut with "…", and the name of a step is 3 lines at most.
// In the side bar, a row of 'In it' or 'Blocked by' says its name on 2 lines at most, as the list of branches does, and its count stays whole.
// The row of a step in a hidden branch answers no click, so while its name or the name in its pill is cut, the browser's tip shows both names whole; while both are whole, it has no tip.
// A link says its name on one line, with the arrow right after it; a link whose name is cut has the whole name in the browser's tip. The side bar scrolls up and down.
// A touch shows no browser tip: where nothing points without a touch, a link, the row of a step in a hidden branch and its pill say their whole names.
// The path at the top of the side bar wraps between words, and keys reach each of its crumbs. A cut never ends in a space or a mark such as ",".
import { test as plain } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { cutLine, wrap, type Fonts } from '../src/view/plan';
import { clashes, everywhere, expect, openPlan, settle, side, step, test, tip, zoomTo } from './helpers';
import { edit, long, nodeOf } from './plans';

/** How wide the name of a branch may be on the plan, and the name of a group over its frame, in the units of the plan. */
const CAP_W = 200, GNAME_W = 250;
/** The top-level branch that 'Long text design' waits for a step of, which a test hides. */
const BETA = long.branches[1].name!;
/** The branch of 'Long text design', and its group. */
const BRANCH = 'Long names, long links and long link lists', GROUP = 'Long text build for the tree, the side bar, the tip and the picker';
const SIZES = [{ width: 1440, height: 900 }, { width: 390, height: 844 }];
/** How the page opens for the side bar of 'Long text design': at 'Every step', with the top-level branch of a step that blocks it hidden. */
const hiding = (branch: string) => ({ store: 'long-text', kept: { level: 2, last: true, branches: { [branch]: false }, id: 'long-text', fx: 0.4, fy: 0.3 } });

/** A text cut short: it ends with "…", with no space or mark such as "," right before it, and the full text starts with what is left of it. */
function cutFrom(drawn: string, full: string, what: string): void {
  expect(drawn, what).toMatch(/[^\s,;:.\-–—]…$/u);
  expect(full.toLocaleLowerCase().startsWith(drawn.slice(0, -1).toLocaleLowerCase()), `${what}: '${drawn}' starts '${full}'`).toBe(true);
}

/** Each text on the plan of a kind that shows, and how wide it is drawn, in the units of the plan. */
const texts = (page: Page, css: string): Promise<{ text: string; w: number }[]> =>
  page.evaluate(css => {
    const svg = document.querySelector<SVGSVGElement>('svg.plan')!, unit = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
    const seen = (e: Element): boolean => getComputedStyle(e).display !== 'none' && Number(e.getAttribute('opacity') ?? 1) > 0.5 && e.getBoundingClientRect().width > 0;
    return [...svg.querySelectorAll(css)].filter(seen).map(t => ({ text: t.textContent ?? '', w: t.getBoundingClientRect().width / unit }));
  }, css);

/** How each row of the side bar under a heading is laid out: how many lines its name takes, whether the name is cut, and where the parts of the row are. */
interface Row {
  name: string;
  lines: number;
  cut: boolean;
  title: string | null;
  row: { left: number; right: number };
  nm: { right: number };
  /** The count of a branch or a group: how many lines it takes, and its right edge. */
  dim?: { lines: number; right: number };
  /** The arrow of a link. */
  go?: { left: number; right: number };
  /** The pill of a step in a hidden branch: its width, the width of the row, and whether the name in it is cut. */
  gone?: { width: number; room: number; right: number; cut: boolean };
}
const rowsOf = (page: Page, heading: string): Promise<Row[]> =>
  side(page).locator('section.part').filter({ has: page.locator('h3', { hasText: heading }) }).locator('.row').evaluateAll(rows => {
    const lines = (e: Element): number => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight));
    const box = (e: Element): { left: number; right: number } => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right }; };
    return rows.map(r => {
      const nm = r.querySelector('.nm')!, dim = r.querySelector('.dim'), go = r.querySelector('.go'), gone = r.querySelector<HTMLElement>('.gone'), cut = gone?.querySelector('.cut');
      const style = getComputedStyle(r);
      return {
        name: nm.textContent ?? '',
        lines: lines(nm),
        cut: nm.scrollHeight > nm.clientHeight + 1 || nm.scrollWidth > nm.clientWidth + 1,
        title: r.getAttribute('title'),
        row: box(r),
        nm: box(nm),
        ...(dim ? { dim: { lines: lines(dim), right: dim.getBoundingClientRect().right } } : {}),
        ...(go ? { go: box(go) } : {}),
        ...(gone && cut ? { gone: { width: gone.getBoundingClientRect().width, room: r.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), right: gone.getBoundingClientRect().right, cut: cut.scrollWidth > cut.clientWidth } } : {}),
      };
    });
  });

/** How far the page, the side bar and the list of branches scroll sideways: 0 where they do not. */
const sideways = (page: Page): Promise<Record<string, number>> =>
  page.evaluate(() => {
    const over = (e: Element | null): number => (e ? e.scrollWidth - e.clientWidth : 0);
    return { page: document.documentElement.scrollWidth - window.innerWidth, body: over(document.body), side: over(document.querySelector('.side')), branches: over(document.querySelector('.branches')) };
  });

async function pick(page: Page, id: string): Promise<void> {
  await step(page, id).click();
  await settle(page);
  await expect(side(page)).toBeVisible();
}

/** A crumb of the path at the top of the side bar, by its name. */
const crumb = (page: Page, name: string): Locator => side(page).locator('.path').getByRole('button', { name, exact: true });

plain('wrap() and cutLine() cut alike: "…" never comes right after a space or a mark such as ","', () => {
  // each letter is 10 units wide
  const fonts: Fonts = { width: s => 10 * s.length, line: 16, top: 12 };
  expect(wrap('aaaa bbbb cccc, dddd', fonts, 'label', 60)).toEqual({ lines: ['aaaa', 'bbbb', 'cccc…'], cut: true });
  expect(cutLine('cccc, dddd', fonts, 'cap', 60)).toBe('cccc…');
  expect(cutLine('cccc dddd', fonts, 'cap', 60)).toBe('cccc…');
  expect(cutLine('cccc: dddd', fonts, 'cap', 70)).toBe('cccc…');
  expect(cutLine('cccc dddd', fonts, 'cap', 90)).toBe('cccc dddd');
});

test('across, at \'Every step\', a long name of a group makes its frame no wider than the frame of a group of the same steps with a short name, in both views', async ({ page }) => {
  await openPlan(page, long, { store: null });
  await zoomTo(page, 'Every step');
  for (const view of ['icons', 'marks']) {
    if (view === 'marks') {
      await page.keyboard.press('i');
      await settle(page);
    }
    // 'Remember the view build', 'Long text build …' and 'Tools button build' each hold one step on each of two tracks
    const widths = await page.locator('svg.plan rect.group').evaluateAll(fs => fs.map(f => Math.round(f.getBoundingClientRect().width)));
    expect(widths, view).toHaveLength(3);
    expect(new Set(widths).size, `${view}: the frames ${widths.join(', ')}`).toBe(1);
  }
});

for (const size of SIZES) {
  test.describe(`at ${size.width}x${size.height}`, () => {
    test.use({ viewport: size });

    test('on the tree a long name of a branch or of a group is one line, cut with "…", and the name of a step 3 lines at most, at every level and in both views; no name touches another, and the tip shows the whole name', async ({ page }) => {
      await openPlan(page, long, { store: null });
      await expect(page.locator('.roadmap')).toHaveAttribute('data-flow', size.width < 664 ? 'v' : 'h');
      const branches = new Map([...long.branches, ...long.branches[2].items.flatMap(it => ('split' in it ? it.split : []))].map(b => [b.name ?? '', b.name ?? '']));
      let cutCaps = 0, cutGroups = 0;
      await everywhere(page, async where => {
        expect(await clashes(page), where).toEqual([]);
        for (const c of await texts(page, 'text.cap')) {
          expect(c.w, `${where}: the name of the branch '${c.text}'`).toBeLessThanOrEqual(CAP_W + 0.5);
          if (c.text.endsWith('…')) {
            cutCaps++;
            cutFrom(c.text, [...branches.keys()].find(b => b.startsWith(c.text.slice(0, -1)))!, `${where}: the name of a branch`);
          }
        }
        for (const g of await texts(page, 'text.gname')) {
          expect(g.w, `${where}: the name of the group '${g.text}'`).toBeLessThanOrEqual(GNAME_W + 0.5);
          if (g.text.endsWith('…')) {
            cutGroups++;
            cutFrom(g.text, GROUP, `${where}: the name of a group`);
          }
        }
        const names = await page.evaluate(() => {
          const flow = document.querySelector('.roadmap')!.getAttribute('data-flow'), lines: Record<string, number> = {};
          for (const t of document.querySelectorAll<SVGTextElement>(`svg.plan text.label[data-id]${flow === 'v' ? '.down' : ':not(.down)'}`)) lines[t.dataset.id!] = (lines[t.dataset.id!] ?? 0) + 1;
          return lines;
        });
        for (const [id, n] of Object.entries(names)) expect(n, `${where}: the lines of the name of ${id}`).toBeLessThanOrEqual(3);
      });
      expect(cutCaps, 'names of branches cut').toBeGreaterThan(0);
      expect(cutGroups, 'names of groups cut').toBeGreaterThan(0);

      await test.step('the tip of a step with a cut name shows the whole name, inside the page', async () => {
        await zoomTo(page, 'Every step');
        const full = nodeOf(long, 'long-text').name;
        await step(page, 'long-text').scrollIntoViewIfNeeded();
        await step(page, 'long-text').hover();
        await expect(tip(page).locator('strong')).toHaveText(full);
        const t = (await tip(page).boundingBox())!;
        expect(t.x).toBeGreaterThanOrEqual(0);
        expect(t.x + t.width).toBeLessThanOrEqual(size.width);
        expect(await sideways(page)).toEqual({ page: 0, body: 0, side: 0, branches: 0 });
      });
    });

    test("the side bar of a step with a long name: 'Blocked by' rows of 2 lines at most, 12 links of one line with the arrow right after the name, the whole name of a cut link in its tip, a path that wraps between words, and a scroll up and down but never sideways", async ({ page }) => {
      await openPlan(page, long, hiding(BETA));
      await pick(page, 'long-text');
      await expect(side(page).locator('h2')).toHaveText(nodeOf(long, 'long-text').name);

      await test.step("'Blocked by': each name on 2 lines at most, cut with \"…\" where it is longer; the pill of the hidden branch on one line, cut, and at most half the row; the browser's tip of that row shows both names whole", async () => {
        const rows = await rowsOf(page, 'Blocked by');
        expect(rows.map(r => r.name)).toEqual(['Remember the view design: zoom, pan, the picked step and open parts stay after a reload', 'HTML export design for strangers who get one file by email and open it from their disk']);
        for (const r of rows) {
          expect(r.lines, r.name).toBeLessThanOrEqual(2);
          expect(r.cut, `${r.name} is cut`).toBe(true);
          expect(r.nm.right, r.name).toBeLessThanOrEqual(r.row.right);
        }
        const gone = rows[1].gone!;
        expect(gone.cut, 'the name in the pill is cut').toBe(true);
        expect(gone.width).toBeLessThanOrEqual(gone.room / 2 + 0.5);
        expect(gone.right).toBeLessThanOrEqual(rows[1].row.right);
        // a click on a step on the plan shows its whole name, so its row has no tip; the row of a step in a hidden branch has the name of the step and of its branch
        expect(rows[0].title, `the tip of ${rows[0].name}`).toBeNull();
        await expect(side(page).locator('.part .row.off')).toHaveAttribute('title', `${rows[1].name}\n${BETA}`);
      });

      await test.step("'Links': 12 rows, each name on one line with the arrow right after it; a cut name is whole in the browser's tip, and a whole name has no tip", async () => {
        const rows = await rowsOf(page, 'Links'), links = nodeOf(long, 'long-text').links!;
        expect(rows.map(r => r.name)).toEqual(links.map(l => l.name));
        for (const r of rows) {
          expect(r.lines, r.name).toBe(1);
          expect(r.go!.left - r.nm.right, `the arrow of ${r.name}`).toBeGreaterThanOrEqual(0);
          expect(r.go!.left - r.nm.right, `the arrow of ${r.name}`).toBeLessThanOrEqual(8.5);
          expect(r.go!.right, `the arrow of ${r.name}`).toBeLessThanOrEqual(r.row.right);
          expect(r.title, `the tip of ${r.name}`).toBe(r.cut ? r.name : null);
        }
        expect(rows.filter(r => r.cut).map(r => r.name)).toContain(links[3].name);
        expect(rows.filter(r => !r.cut).map(r => r.name)).toContain('Issue 41');
      });

      await test.step('the path: one text that wraps between words, with the start of the long name on the line of its first crumb', async () => {
        const at = await side(page).locator('.path .crumb').evaluateAll(cs => cs.map(c => ({ name: c.textContent, rects: [...c.getClientRects()].map(r => ({ top: r.top, right: r.right })) })));
        const path = (await side(page).locator('.path').boundingBox())!;
        expect(at.map(c => c.name)).toEqual(['v1.0.0', BRANCH]);
        expect(Math.abs(at[1].rects[0].top - at[0].rects[0].top), 'the long name starts on the line of v1.0.0').toBeLessThan(1);
        for (const c of at) for (const r of c.rects) expect(r.right, c.name!).toBeLessThanOrEqual(path.x + path.width + 0.5);
      });

      await test.step('the side bar scrolls up and down to its last part, and never sideways; nor does the page', async () => {
        expect(await sideways(page)).toEqual({ page: 0, body: 0, side: 0, branches: 0 });
        const bar = await side(page).evaluate(e => ({ scroll: e.scrollHeight, height: e.clientHeight, overflow: getComputedStyle(e).overflowY }));
        expect(bar.overflow).toBe('auto');
        expect(bar.scroll).toBeGreaterThan(bar.height);
        const last = side(page).locator('section.part').last();
        await expect(last.locator('h3')).toHaveText('Done when');
        await side(page).evaluate(e => { e.scrollTop = e.scrollHeight; });
        const s = (await side(page).boundingBox())!, l = (await last.boundingBox())!;
        expect(l.y + l.height).toBeLessThanOrEqual(s.y + s.height);
        expect(await sideways(page)).toEqual({ page: 0, body: 0, side: 0, branches: 0 });
      });

      await test.step("keys reach each crumb: Enter on the long branch shows its 'In it', with each name on 2 lines at most and its count whole", async () => {
        await side(page).evaluate(e => { e.scrollTop = 0; });
        await crumb(page, BRANCH).focus();
        await expect(crumb(page, BRANCH)).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(side(page).locator('h2')).toHaveText(BRANCH);
        const rows = await rowsOf(page, 'In it');
        expect(rows.map(r => r.name)).toEqual([nodeOf(long, 'long-text').name, GROUP]);
        for (const r of rows) expect(r.lines, r.name).toBeLessThanOrEqual(2);
        // the sheet of a phone is wider than the side bar: there both names fit on 2 lines
        expect(rows.filter(r => r.cut).map(r => r.name)).toEqual(size.width < 664 ? [] : [nodeOf(long, 'long-text').name, GROUP]);
        expect(rows[1].dim!.lines, 'the count').toBe(1);
        expect(rows[1].dim!.right).toBeLessThanOrEqual(rows[1].row.right);
        expect(rows[1].nm.right).toBeLessThanOrEqual(rows[1].dim!.right);
        // Space works it too, as on a button
        await crumb(page, 'v1.0.0').focus();
        await page.keyboard.press(' ');
        await expect(side(page).locator('h2')).toHaveText('v1.0.0');
        expect(await sideways(page)).toEqual({ page: 0, body: 0, side: 0, branches: 0 });
      });
    });

    test('the row of a step in a hidden branch has no browser tip while the name of the step and the name in its pill are whole', async ({ page }) => {
      const short = edit(long, p => {
        p.branches[1].name = 'Beta';
        nodeOf(p, 'html-export-design').name = 'Export';
      });
      await openPlan(page, short, hiding('Beta'));
      await pick(page, 'long-text');
      // the tips are set: a cut link has its tip
      await expect(side(page).locator('a.row[title]').first()).toBeAttached();
      const off = (await rowsOf(page, 'Blocked by'))[1];
      expect(off.name).toBe('Export');
      expect(off.cut, 'the name is cut').toBe(false);
      expect(off.gone!.cut, 'the name in the pill is cut').toBe(false);
      expect(off.title).toBeNull();
    });

    test("'Show only blockers' writes the name of each step on 3 lines at most, cut with \"…\", as on the plan", async ({ page }) => {
      await openPlan(page, long, { store: 'long-text', kept: { level: 2, last: true, id: 'long-text', fx: 0.4, fy: 0.4 } });
      await pick(page, 'long-text');
      await side(page).getByRole('button', { name: 'Show only blockers' }).click();
      await settle(page);
      const names = await page.locator('.roadmap .names div').evaluateAll(ds => ds.map(d => ({
        name: d.textContent, lines: Math.round(d.getBoundingClientRect().height / parseFloat(getComputedStyle(d).lineHeight)), cut: d.scrollHeight > d.clientHeight + 1,
      })));
      expect(names.map(n => n.name)).toEqual(['long-text', 'remember', 'html-export-design'].map(id => nodeOf(long, id).name));
      for (const n of names) {
        expect(n.lines, n.name!).toBeLessThanOrEqual(3);
        expect(n.cut, `${n.name} is cut`).toBe(true);
      }
      expect(await sideways(page)).toEqual({ page: 0, body: 0, side: 0, branches: 0 });
    });

    test('the list of branches says each long name on 2 lines at most, cut with "…", its count whole, and it never scrolls sideways', async ({ page }) => {
      await openPlan(page, long, { store: null });
      await page.locator('.zoom').getByRole('button', { name: 'Branches', exact: true }).click();
      await settle(page);
      const rows = await page.locator('.branches .pick').evaluateAll(ps => ps.map(p => {
        const nm = p.querySelector('.name')!, dim = p.querySelector('.dim')!, lh = parseFloat(getComputedStyle(nm).lineHeight);
        return { name: nm.textContent, lines: Math.round(nm.getBoundingClientRect().height / lh), cut: nm.scrollHeight > nm.clientHeight + 1, dim: Math.round(dim.getBoundingClientRect().height / parseFloat(getComputedStyle(dim).lineHeight)), right: dim.getBoundingClientRect().right, edge: p.getBoundingClientRect().right };
      }));
      expect(rows.map(r => r.name)).toEqual(long.branches.map(b => b.name));
      for (const r of rows) {
        expect(r.lines, r.name!).toBeLessThanOrEqual(2);
        expect(r.dim, `the count of ${r.name}`).toBe(1);
        expect(r.right).toBeLessThanOrEqual(r.edge);
      }
      // the list is as wide as a phone, less 8 px at each side: there the long names fit on 2 lines
      expect(rows.filter(r => r.cut).map(r => r.name)).toEqual(size.width < 664 ? [] : [long.branches[0].name, BETA]);
      expect(await sideways(page)).toEqual({ page: 0, body: 0, side: 0, branches: 0 });
    });
  });
}

// a touch shows no browser tip, so where nothing points without a touch, as on a phone or a tablet, no row that relies on the tip cuts its text
for (const size of SIZES) {
  test.describe(`at ${size.width}x${size.height}, by touch only`, () => {
    test.use({ viewport: size, hasTouch: true });

    test("the row of a step in a hidden branch, its pill and each link under 'Links' say their whole names, have no browser tip, and nothing scrolls sideways", async ({ page }) => {
      await openPlan(page, long, hiding(BETA));
      await pick(page, 'long-text');
      const off = (await rowsOf(page, 'Blocked by'))[1];
      expect(off.name).toBe(nodeOf(long, 'html-export-design').name);
      expect(off.cut, 'the name is cut').toBe(false);
      expect(off.lines, 'the lines of the name').toBeGreaterThan(2);
      expect(off.gone!.cut, 'the name in the pill is cut').toBe(false);
      expect(off.gone!.width).toBeLessThanOrEqual(off.gone!.room / 2 + 0.5);
      expect(off.gone!.right).toBeLessThanOrEqual(off.row.right);
      expect(off.title).toBeNull();
      await expect(side(page).locator('.row.off .gone')).toHaveText(BETA);

      const links = await rowsOf(page, 'Links');
      expect(links.map(r => r.name)).toEqual(nodeOf(long, 'long-text').links!.map(l => l.name));
      for (const r of links) {
        expect(r.cut, `${r.name} is cut`).toBe(false);
        expect(r.title, `the tip of ${r.name}`).toBeNull();
        expect(r.go!.left, `the arrow of ${r.name}`).toBeGreaterThanOrEqual(r.nm.right);
        expect(r.go!.right, `the arrow of ${r.name}`).toBeLessThanOrEqual(r.row.right);
      }
      expect(links.find(r => r.name === nodeOf(long, 'long-text').links![3].name)!.lines, 'the lines of a long address').toBeGreaterThan(1);
      expect(await sideways(page)).toEqual({ page: 0, body: 0, side: 0, branches: 0 });
    });
  });
}
