// Names: a name wraps by how wide the theme's font draws it, to 3 lines at most, none wider than the room between two steps.
// Only a longer name is cut. No name touches another name, a step, a pill, a frame or a caption.
import type { Page } from '@playwright/test';
import { expect, labels, level, levels, nameOf, nameSize, openApp, openPlan, settle, side, step, test, tip, zoomTo } from './helpers';
import { full, nodeOf, nodesOf, wordy } from './plans';

/** How wide a line of a name may be, in the units of the plan: the room between two steps, less a gap. */
const NAME_W = 100;

/** The lines of the name of a step, as drawn. */
const linesOf = (page: Page, id: string): Promise<string[]> => nameOf(page, id).allTextContents();

/** What lies on what on the plan, as drawn: the name of each step and group step, all its lines as one box; each caption, group name and count; each step and pill.
 * A name or a caption may lie inside a frame, but not across its edge. Each clash is told as its two parts. */
async function clashes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const seen = (e: Element): boolean => getComputedStyle(e).display !== 'none' && Number(e.getAttribute('opacity') ?? 1) > 0.5 && e.getBoundingClientRect().width > 0;
    type B = { k: string; l: number; r: number; t: number; b: number };
    const of = (k: string, rs: DOMRect[]): B => ({ k, l: Math.min(...rs.map(r => r.left)), r: Math.max(...rs.map(r => r.right)), t: Math.min(...rs.map(r => r.top)), b: Math.max(...rs.map(r => r.bottom)) });
    const names = new Map<string, DOMRect[]>();
    for (const t of document.querySelectorAll<SVGTextElement>('svg.plan text.label')) {
      if (!seen(t)) continue;
      const k = t.dataset.id ? `the name of ${t.dataset.id}` : `the name of the group ${t.textContent}`;
      names.set(k, [...(names.get(k) ?? []), t.getBoundingClientRect()]);
    }
    const parts: B[] = [...names].map(([k, rs]) => of(k, rs));
    for (const t of document.querySelectorAll('svg.plan text.cap, svg.plan text.gname, svg.plan text.count')) if (seen(t)) parts.push(of(`${t.getAttribute('class')} '${t.textContent}'`, [t.getBoundingClientRect()]));
    for (const g of document.querySelectorAll<SVGGElement>('svg.plan g.zn, svg.plan g.tally')) if (seen(g)) parts.push(of(`the step ${g.dataset.id ?? g.dataset.pod ?? g.dataset.bar}`, [g.getBoundingClientRect()]));
    const frames = [...document.querySelectorAll('svg.plan rect.group')].filter(seen).map(f => of('a frame', [f.getBoundingClientRect()]));
    const on = (a: B, b: B): boolean => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
    const within = (a: B, f: B): boolean => a.l >= f.l - 0.5 && a.r <= f.r + 0.5 && a.t >= f.t - 0.5 && a.b <= f.b + 0.5;
    const out: string[] = [];
    parts.forEach((a, i) => {
      for (const b of parts.slice(i + 1)) if (on(a, b)) out.push(`${a.k} on ${b.k}`);
      for (const f of frames) if (on(a, f) && !within(a, f)) out.push(`${a.k} across the edge of a frame`);
    });
    return out;
  });
}

/** At every level, in both views: the check. */
async function everywhere(page: Page, check: (where: string) => Promise<void>): Promise<void> {
  for (const view of ['icons', 'marks']) {
    if (view === 'marks') {
      await page.keyboard.press('i');
      await settle(page);
    }
    for (const name of await levels(page)) {
      await zoomTo(page, name);
      await check(`${view}, '${name}'`);
    }
  }
}

/** The lines of the name of each step, and how wide each line is drawn in the units of the plan: all read at once, in the page. */
const allLines = (page: Page, ids: string[]): Promise<Record<string, { text: string; w: number }[]>> =>
  page.evaluate(([ids, css]) => {
    const svg = document.querySelector<SVGSVGElement>('svg.plan')!, unit = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
    return Object.fromEntries(ids.map(id => [id, [...document.querySelectorAll(css.replaceAll('[data-id]', `[data-id="${id}"]`))].map(t => ({ text: t.textContent ?? '', w: t.getBoundingClientRect().width / unit }))]));
  }, [ids, labels('[data-id]')] as const);

test('no long name touches another, at every level and in both views; a long name wraps by its width to 3 lines at most, none wider than the room between two steps; only a longer one is cut with "…", and its tip and the side bar keep it whole', async ({ page }) => {
  await openPlan(page, wordy, { store: null });

  await test.step('no long name touches another name, a step, a pill, a frame or a caption, at every level and in both views', async () => {
    await everywhere(page, async where => expect(await clashes(page), where).toEqual([]));
  });

  // back to the view with icons; everywhere() ends at 'Every step'
  await page.keyboard.press('i');
  await settle(page);
  expect(await level(page)).toBe('Every step');
  const drawn = await allLines(page, nodesOf(wordy).map(n => n.id));

  await test.step('a long name wraps by its width, to 3 lines at most, none wider than the room between two steps', async () => {
    for (const n of nodesOf(wordy)) {
      const lines = drawn[n.id].map(l => l.text);
      expect(lines.length, n.id).toBeLessThanOrEqual(3);
      expect(Math.max(...drawn[n.id].map(l => l.w)), `the widest line of ${n.id}`).toBeLessThanOrEqual(NAME_W + 0.5);
      // a name that is not cut is all there, word for word
      if (!lines[lines.length - 1].endsWith('…')) expect(lines.join('').replace(/\s/g, ''), n.id).toBe(n.name.replace(/\s/g, ''));
    }
    expect(drawn['w-2']).toHaveLength(3);
    // by its width, not by how many letters it has: narrow letters stay on one line, fewer wide ones do not
    expect(drawn['w-6'].map(l => l.text)).toEqual(['iiii iiii iiii iiii']);
    expect(drawn['w-7'].map(l => l.text)).toEqual(['WWWWW', 'MMMMM']);
    // a word too wide for a line is broken in it, and nothing is lost
    expect(drawn['w-3']).toHaveLength(2);
  });

  await test.step('only a name longer than 3 lines is cut with "…"; its tip and the side bar keep the full name', async () => {
    expect(nodesOf(wordy).filter(n => drawn[n.id].at(-1)!.text.endsWith('…')).map(n => n.id), 'the names cut').toEqual(['w-4']);
    const full = nodeOf(wordy, 'w-4').name;
    await step(page, 'w-4').hover();
    await expect(tip(page).locator('strong')).toHaveText(full);
    await step(page, 'w-4').click();
    await expect(side(page).locator('h2')).toHaveText(full);
  });
});

test('on his page no name touches another name, a step, a pill, a frame or a caption, at every level and in both views', async ({ page }) => {
  await openApp(page);
  await everywhere(page, async where => expect(await clashes(page), where).toEqual([]));
});

/** Across, for each name of a step: the room under it to its own step, and over it to the nearest step or pill of another lane. Each body is its coin where the icons show, else its mark. */
async function rooms(page: Page): Promise<{ k: string; under: number; over: number }[]> {
  return page.evaluate(() => {
    const seen = (e: Element): boolean => getComputedStyle(e).display !== 'none' && Number(e.getAttribute('opacity') ?? 1) > 0.5 && e.getBoundingClientRect().width > 0;
    const bodyOf = (g: Element): DOMRect | undefined => {
      const coin = g.querySelector('.coin');
      const part = coin && seen(coin) && getComputedStyle(coin).opacity !== '0' ? coin : g.querySelector('.st');
      return part && seen(part) ? part.getBoundingClientRect() : undefined;
    };
    const bodies = new Map<string, DOMRect>();
    for (const g of document.querySelectorAll<SVGGElement>('svg.plan g.zn')) {
      const r = seen(g) && bodyOf(g);
      if (r) bodies.set(g.dataset.id ?? `pod ${g.dataset.pod}`, r);
    }
    for (const g of document.querySelectorAll<SVGGElement>('svg.plan g.tally')) if (seen(g)) bodies.set(`pill ${g.dataset.bar}`, g.getBoundingClientRect());
    const names = new Map<string, DOMRect[]>();
    for (const t of document.querySelectorAll<SVGTextElement>('svg.plan text.label:not(.down)')) {
      const k = t.dataset.id ?? `pod ${t.dataset.pod}`;
      if (seen(t) && bodies.has(k)) names.set(k, [...(names.get(k) ?? []), t.getBoundingClientRect()]);
    }
    return [...names].map(([k, rs]) => {
      const l = Math.min(...rs.map(r => r.left)), r = Math.max(...rs.map(r => r.right)), t = Math.min(...rs.map(r => r.top)), b = Math.max(...rs.map(r => r.bottom));
      const above = [...bodies].filter(([o, s]) => o !== k && s.left < r && l < s.right && s.bottom <= t + 0.5).map(([, s]) => t - s.bottom);
      return { k, under: bodies.get(k)!.top - b, over: Math.min(Infinity, ...above) };
    });
  });
}

test('across, the name of a step is at least 3 times as far from the step or pill of the lane over it as from its own step, so it reads as its own: on his page, on long names, and on steps with no icon among coins, at every level and in both views', async ({ page }) => {
  const opens: [string, () => Promise<void>][] = [['his page', () => openApp(page)], ['wordy', () => openPlan(page, wordy, { store: null })], ['full', () => openPlan(page, full, { store: null })]];
  for (const [plan, open] of opens) {
    await open();
    await everywhere(page, async where => {
      const r = await rooms(page);
      expect(r.length, `${plan}, ${where}: names measured`).toBeGreaterThan(0);
      for (const x of r) expect(x.over, `${plan}, ${where}: the room over the name of ${x.k}, with ${x.under.toFixed(1)} under it`).toBeGreaterThanOrEqual(3 * x.under);
    });
  }
});

test('a font of the theme that loads later: the names are wrapped again in it, at the same level, scale and place, with the same pick', async ({ page }) => {
  await openPlan(page, wordy, { store: 'names.font', kept: { level: 1, icons: true, scale: 1.5, id: 'w-1', fx: 0.3, fy: 0.5 } });
  await step(page, 'w-1').click();
  await settle(page);
  const size = await nameSize(page), at = await step(page, 'w-1').boundingBox();
  expect(await linesOf(page, 'w-6')).toHaveLength(1);
  // the theme's font draws wider, as a web font may once it has loaded
  await page.addStyleTag({ content: '.label { letter-spacing: 3px; }' });
  await page.evaluate(() => document.fonts.dispatchEvent(new Event('loadingdone')));
  await settle(page);
  expect((await linesOf(page, 'w-6')).length).toBeGreaterThan(1);
  expect(await level(page)).toBe('Tracks');
  expect(await nameSize(page)).toBeCloseTo(size, 3);
  const now = await step(page, 'w-1').boundingBox();
  expect(Math.abs(now!.x - at!.x)).toBeLessThan(1);
  expect(Math.abs(now!.y - at!.y)).toBeLessThan(1);
  await expect(side(page).locator('h2')).toHaveText('Start');
  expect(await clashes(page)).toEqual([]);
});
