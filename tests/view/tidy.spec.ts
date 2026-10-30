// A tidy place: the first view cuts nothing in two at an edge of the stage or at the zoom control, not even a sliver.
// At the end of the plan it goes past the end to show a thing whole or hide it.
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { publicRoadmap } from '../../src/roadmap/public';
import type { Roadmap } from '../../src/roadmap/types';
import { expect, openPlan, settle, test } from '../support/helpers';
import { edit, nodesOf } from '../support/plans';

/** The roadmap of the app page. */
const ROADMAP = JSON.parse(readFileSync(new URL('../fixtures/roadmap.json', import.meta.url), 'utf8')) as Roadmap;
/** What a stranger sees of the roadmap as its first version goes out: all done but 'Release v1', the last step of the plan, which the page opens on. */
const releasing = edit(publicRoadmap(ROADMAP), p => {
  for (const n of nodesOf(p)) if (n.state !== 'canceled') n.state = n.name === 'Release v1' ? 'todo' : 'done';
});
/** What an edge of the stage or the zoom control cuts now, as the view takes it: each name, count, step, pill and tally less than 1 px past an edge, so a sliver of it may show, and more than 2 px out. */
const cutNow = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const stage = document.querySelector('.roadmap .stage')!, s = stage.getBoundingClientRect(), bar = document.querySelector('.roadmap .zoom')!.getBoundingClientRect();
    const V = { l: s.left, t: s.top, r: s.left + stage.clientWidth, b: s.top + stage.clientHeight };
    const seen = (e: Element): boolean => {
      for (let x: Element | null = e; x && x.tagName !== 'svg'; x = x.parentElement) if (getComputedStyle(x).display === 'none' || Number(x.getAttribute('opacity') ?? 1) < 0.5) return false;
      return true;
    };
    const cut = (e: Element): boolean => {
      const r = e.getBoundingClientRect();
      if (!seen(e) || Math.min(r.right, V.r) - Math.max(r.left, V.l) <= -1 || Math.min(r.bottom, V.b) - Math.max(r.top, V.t) <= -1) return false;
      if (r.left < V.l - 2 || r.right > V.r + 2 || r.top < V.t - 2 || r.bottom > V.b + 2) return true;
      // under the zoom control in part
      const under = Math.min(r.right, bar.right) - Math.max(r.left, bar.left) > 2 && Math.min(r.bottom, bar.bottom) - Math.max(r.top, bar.top) > 2;
      return under && !(r.left >= bar.left && r.right <= bar.right && r.top >= bar.top && r.bottom <= bar.bottom);
    };
    return [...document.querySelectorAll('svg.plan text, svg.plan .coin, svg.plan g.zn > .st, svg.plan .zbar, svg.plan .tally')].filter(cut)
      .map(e => e.textContent || `${e.getAttribute('class')} ${e.closest('[data-id]')?.getAttribute('data-id') ?? e.closest('[data-bar]')?.getAttribute('data-bar') ?? ''}`);
  });

test('at the end of the plan, the first view cuts nothing', async ({ page }) => {
  // a new size puts a first view that the user has not moved again, as a new visit at that size does
  for (const [i, [width, height]] of [[1440, 900], [1280, 800], [1024, 768], [768, 1024], [390, 844], [414, 896], [375, 667]].entries()) {
    await test.step(`the first view at ${width}x${height} cuts nothing`, async () => {
      await page.setViewportSize({ width, height });
      if (i === 0) await openPlan(page, releasing, { store: null });
      else await settle(page);
      expect(await cutNow(page)).toEqual([]);
    });
  }
});
