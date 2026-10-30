// The side bar: a click picks a step, a group or a branch, lights it in gold and shows what the plan says of it, and the picked thing stays clear of the side bar.
// A pick lives through a save while its thing is in the plan; long text fits the side bar; on a phone the side bar is a sheet at the bottom.
import type { Locator, Page } from '@playwright/test';
import { caption, expect, group, level, nameOf, openPlan, pickLayout, pill, play, save, settle, side, step, stopClock, test, toolsButton, zoomTo } from '../support/helpers';
import { columns, edit, full, links, long, nodeOf, wordy } from '../support/plans';

/** The gold of the theme, as the browser gives back a color. */
const gold = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const e = document.createElement('i');
    e.style.color = 'var(--name)';
    document.body.append(e);
    const c = getComputedStyle(e).color;
    e.remove();
    return c;
  });

/** The ring that lights a step when it is pointed at or picked. */
const ringOf = (page: Page, id: string): Locator => step(page, id).locator('.aura').first();
/** A part of the side bar, by its heading. */
const part = (page: Page, name: string): Locator => side(page).locator('section.part').filter({ has: page.locator('h3', { hasText: name }) });
/** The headings of the parts of the side bar. */
const parts = (page: Page): Locator => side(page).locator('section.part h3');
/** The rows of the 'Links' part. */
const linkRows = (page: Page): Locator => side(page).locator('a.row');
/** The heading of the 'Links' part, which closes and opens it. */
const fold = (page: Page): Locator => side(page).getByRole('button', { name: 'Links' });
/** The name of what the side bar shows. */
const heading = (page: Page): Locator => side(page).locator('h2');
/** A row of the side bar that picks its thing, by its name. */
const row = (page: Page, name: string | RegExp): Locator => side(page).getByRole('button', typeof name === 'string' ? { name, exact: true } : { name });

/** A point on the drawn line of a branch, by its caption, where nothing else lies over the line. */
async function onLine(page: Page, branch: string): Promise<{ x: number; y: number }> {
  const key = await caption(page, branch).getAttribute('data-bar');
  const at = await page.evaluate(k => {
    for (const p of document.querySelectorAll<SVGPathElement>(`svg.plan path.hit[data-bar="${k}"]`)) {
      if (p.style.display === 'none') continue;
      const m = p.getScreenCTM()!, len = p.getTotalLength();
      for (let f = 0.5; f < 1; f += 0.05) for (const g of [f, 1 - f]) {
        const q = p.getPointAtLength(len * g), x = m.a * q.x + m.c * q.y + m.e, y = m.b * q.x + m.d * q.y + m.f;
        if (document.elementFromPoint(x, y) === p) return { x, y };
      }
    }
    return null;
  }, key);
  if (!at) throw new Error(`no free point on the line of '${branch}'`);
  return at;
}

/** Empty space on the plan 'full' at 'Tracks': between its two top-level branches, wherever the plan is scrolled across. */
const EMPTY = { x: 700, y: 480 };

/** The box of a thing comes to lie clear of the side bar, and on the screen. A glide may start a few frames after the click, so this waits for it. */
async function clearOfSide(page: Page, thing: Locator): Promise<void> {
  const s = (await side(page).boundingBox())!;
  await expect.poll(async () => {
    const r = await thing.boundingBox();
    return r && r.width > 0 ? r.x + r.width : Infinity;
  }, { message: 'the picked thing ends left of the side bar' }).toBeLessThanOrEqual(s.x);
  const r = (await thing.boundingBox())!;
  expect(r.x, 'the picked thing is on the screen').toBeGreaterThanOrEqual(0);
}

/** The top-level branch that 'Long text design' waits for a step of, which a test hides. */
const BETA = long.branches[1].name!;
/** The branch of 'Long text design', and its group. */
const BRANCH = 'Long names, long links and long link lists', GROUP = 'Long text build for the tree, the side bar, the tip and the picker';
const SIZES = [{ width: 1440, height: 900 }, { width: 390, height: 844 }];
/** What the page keeps to open on the side bar of 'Long text design': at 'Every step', with these top-level branches hidden, by their names. */
const hiding = (...names: string[]) => ({ level: 2, last: true, branches: Object.fromEntries(names.map(n => [n, false])), id: 'long-text', fx: 0.4, fy: 0.3 });
/** The plan 'long' with short names for the top-level branch 'v1.0.0-beta: …' and for its step that blocks 'Long text design'. */
const short = edit(long, p => {
  p.branches[1].name = 'Beta';
  nodeOf(p, 'html-export-design').name = 'Export';
});

/** How each row of the side bar under a heading is laid out: how many lines its name takes, whether the name is cut, and where the parts of the row are. */
interface Row {
  name: string;
  lines: number;
  cut: boolean;
  title: string | null;
  row: { left: number; right: number };
  nm: { right: number };
  /** The name in bold of a link. */
  strong?: { right: number };
  /** The count of a branch or a group: how many lines it takes, and its right edge. */
  dim?: { lines: number; right: number };
  /** The arrow of a link. */
  go?: { left: number; right: number };
  /** The pill of a step in a hidden branch: its width, the width of the row, and whether the name in it is cut. */
  gone?: { width: number; room: number; right: number; cut: boolean };
}
const rowsOf = (page: Page, heading: string): Promise<Row[]> =>
  part(page, heading).locator('.row').evaluateAll(rows => {
    const lines = (e: Element): number => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight));
    const box = (e: Element): { left: number; right: number } => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right }; };
    return rows.map(r => {
      const nm = r.querySelector('.nm')!, dim = r.querySelector('.dim'), go = r.querySelector('.go'), strong = r.querySelector('.strong');
      const gone = r.querySelector<HTMLElement>('.gone'), cut = gone?.querySelector('.cut'), style = getComputedStyle(r);
      return {
        name: nm.textContent ?? '',
        lines: lines(nm),
        cut: nm.scrollHeight > nm.clientHeight + 1 || nm.scrollWidth > nm.clientWidth + 1,
        title: r.getAttribute('title'),
        row: box(r),
        nm: box(nm),
        ...(strong ? { strong: box(strong) } : {}),
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
const STILL = { page: 0, body: 0, side: 0, branches: 0 };

/** A crumb of the path at the top of the side bar, by its name. */
const crumb = (page: Page, name: string): Locator => side(page).locator('.path').getByRole('button', { name, exact: true });

test("a click at 'Main steps' picks a group or its step", async ({ page }) => {
  await openPlan(page, full, { store: null });
  const g = await gold(page);

  await test.step("a group at 'Main steps' lists its tracks as rows", async () => {
    expect(await level(page)).toBe('Main steps');
    await page.locator('svg.plan g.zn[data-pod]').filter({ visible: true }).first().click();
    await expect(heading(page)).toHaveText('Two deep');
    await expect(side(page).locator('button.row')).toHaveText([/^Outer A/, /^Outer B/]);
  });

  await test.step('a step picked in the rows lights its group step in gold', async () => {
    await group(page, 'Four steps').click();
    await row(page, /^Quad/).click();
    await row(page, 'Quad two').click();
    await expect(heading(page)).toHaveText('Quad two');
    await expect(group(page, 'Four steps').locator('.aura')).toHaveCSS('stroke', g);
    expect(await level(page)).toBe('Main steps');
    await clearOfSide(page, group(page, 'Four steps'));
  });

  await test.step('a picked group stays that group when items come before it', async () => {
    await group(page, 'Four steps').click();
    await expect(heading(page)).toHaveText('Four steps');
    await save(page, edit(full, c => {
      c.branches[0].items.unshift(
        { id: 'new-1', name: 'New one' },
        { name: 'New pair', split: [{ name: 'New A', items: [{ id: 'new-a', name: 'New A one' }] }, { name: 'New B', items: [{ id: 'new-b', name: 'New B one' }] }] },
      );
    }));
    await expect(heading(page)).toHaveText('Four steps');
    await expect(group(page, 'Four steps').locator('.aura')).toHaveCSS('stroke', g);
    await expect(group(page, 'Two deep').locator('.aura')).not.toHaveCSS('stroke', g);
    await save(page, full);
  });

  await test.step("'Private' tags each private thing in its side bar", async () => {
    const tags = (): Promise<string[]> => side(page).locator('.facts .tag').allTextContents();
    await expect(heading(page)).toHaveText('Four steps');
    expect(await tags(), 'a group in a shown branch').not.toContain('Private');
    // the group 'Three deep', its track 'Level 2' with the step 'Level 2 one', and the step 'Later one' are in the private branch 'Later'
    await group(page, 'Three deep').click();
    await expect(heading(page)).toHaveText('Three deep');
    expect(await tags()).toEqual(['Private']);
    await row(page, /^Level 2/).click();
    await expect(heading(page)).toHaveText('Level 2');
    expect(await tags(), 'a track').toEqual(['Private']);
    await row(page, 'Level 2 one').click();
    await expect(heading(page)).toHaveText('Level 2 one');
    expect(await tags(), 'a step in a group').toEqual(['Private']);
    await step(page, 'later-1').click();
    await expect(heading(page)).toHaveText('Later one');
    expect(await tags(), 'a step').toEqual(['Private']);
    await save(page, edit(full, c => { nodeOf(c, 'plan').private = true; }));
    await step(page, 'plan').click();
    await expect(heading(page)).toHaveText('Plan');
    expect(await tags(), 'a private step in a shown branch').toEqual(['Private']);
  });
});

/** Opens the plan 'full' at 'Tracks', with nothing kept. */
async function atTracks(page: Page): Promise<void> {
  await openPlan(page, full, { store: null });
  await zoomTo(page, 'Tracks');
}

test('a click picks a step or a branch for the side bar', async ({ page }) => {
  await atTracks(page);
  const g = await gold(page);

  await test.step('a step lights in gold, and the side bar shows its facts', async () => {
    await step(page, 'kickoff').click();
    await expect(ringOf(page, 'kickoff')).toHaveCSS('stroke', g);
    await expect(ringOf(page, 'kickoff')).toHaveCSS('opacity', '1');
    await expect(nameOf(page, 'kickoff')).toHaveCSS('fill', g);
    await expect(heading(page)).toHaveText('Kickoff');
    await expect(side(page).locator('.facts')).toContainText('Done');
    await expect(side(page).locator('.facts')).toContainText('Milestone');
    expect(await side(page).locator('.facts .tag').allTextContents()).not.toContain('Private');
    await expect(part(page, 'Why').locator('p')).toHaveText('Every later step needs a start.');
    await expect(part(page, 'Done when').locator('p')).toHaveText('The team has met once.');
    await expect(part(page, 'Planned').locator('p')).toHaveText('Jan 5, 2026 to Jan 9, 2026');
    await expect(part(page, 'Deadline').locator('p')).toHaveText('Jan 10, 2026');
  });

  await test.step('Escape closes the side bar', async () => {
    await page.keyboard.press('Escape');
    await expect(side(page)).toBeHidden();
  });

  await test.step('a click on empty space lets go of the pick', async () => {
    await step(page, 'kickoff').click();
    await expect(side(page)).toBeVisible();
    await settle(page);
    await page.mouse.click(EMPTY.x, EMPTY.y);
    await expect(side(page)).toBeHidden();
    await expect(ringOf(page, 'kickoff')).not.toHaveCSS('stroke', g);
  });

  await test.step('a branch picked on its line lists its steps as rows', async () => {
    await settle(page);
    const at = await onLine(page, 'Main');
    await page.mouse.click(at.x, at.y);
    await expect(heading(page)).toHaveText('Main');
    const rows = await side(page).locator('button.row').allInnerTexts();
    expect(rows.map(r => r.split('\n')[0].trim())).toEqual(
      ['Kickoff', 'Plan', 'Two deep', 'In a row', 'Four steps', 'Path A', 'Path B', 'Review', 'Spin-off', 'Dead end', 'Launch'].map(n => expect.stringMatching(new RegExp(`^${n}$`, 'i'))),
    );
  });

  await test.step('a row of a branch picks its step', async () => {
    await row(page, 'Review').click();
    await expect(heading(page)).toHaveText('Review');
    await expect(ringOf(page, 'review')).toHaveCSS('stroke', g);
  });

  await test.step("the button 'Close' closes the side bar", async () => {
    await side(page).getByRole('button', { name: 'Close' }).click();
    await expect(side(page)).toBeHidden();
  });

  await test.step('a branch picked on its name lights its line in gold', async () => {
    await caption(page, 'Path A').click();
    await expect(heading(page)).toHaveText('Path A');
    await expect(page.locator('svg.plan path.lane.picked').first()).toHaveCSS('stroke', g);
  });

  await test.step('a row of a step in a closed track lights the pill', async () => {
    await caption(page, 'Quad').click();
    await expect(side(page).locator('button.row')).toHaveText(['Quad one', 'Quad two', 'Quad three', 'Quad four']);
    await row(page, 'Quad two').click();
    await expect(heading(page)).toHaveText('Quad two');
    await expect(step(page, 'q-2')).toBeHidden();
    await expect(pill(page, 'Quad').locator('text')).toHaveCSS('fill', g);
  });
});

test('a save keeps the pick while its thing is in the plan', async ({ page }) => {
  await atTracks(page);
  const g = await gold(page);

  await test.step('a picked branch stays picked when it is renamed', async () => {
    await caption(page, 'Quad').click();
    await save(page, edit(full, c => {
      const four = c.branches[0].items.find(it => 'split' in it && it.name === 'Four steps');
      if (four && 'split' in four) four.split[0].name = 'Quartet';
    }));
    await expect(heading(page)).toHaveText('Quartet');
    await save(page, full);
    await page.keyboard.press('Escape');
  });

  await test.step('a picked branch stays that branch when a branch comes before it', async () => {
    await caption(page, 'Later').click();
    await expect(heading(page)).toHaveText('Later');
    await save(page, edit(full, c => { c.branches.unshift({ name: 'First', items: [{ id: 'new-1', name: 'New one' }] }); }));
    await expect(heading(page)).toHaveText('Later');
    await expect(caption(page, 'Later')).toHaveClass(/(^| )picked( |$)/);
    await expect(caption(page, 'Main')).not.toHaveClass(/(^| )picked( |$)/);
    await save(page, full);
    await page.keyboard.press('Escape');
  });

  await test.step("a blocked step lists its blockers first, with 'Show only blockers'", async () => {
    await step(page, 'review').click();
    await expect(heading(page)).toHaveText('Review');
    await expect(parts(page).first()).toHaveText('Blocked by');
    await expect(part(page, 'Blocked by').locator('.row')).toHaveText(['Quad four', 'Path B one']);
    await expect(row(page, 'Show only blockers')).toBeVisible();
    // a step it waits for that is done blocks it no more
    await save(page, edit(full, c => { nodeOf(c, 'pb-1').state = 'done'; }));
    await expect(part(page, 'Blocked by').locator('.row')).toHaveText(['Quad four']);
  });

  await test.step('a picked step shows its new data, still in gold', async () => {
    await save(page, edit(full, c => {
      const n = nodeOf(c, 'review');
      n.why = 'A new reason.';
      n.state = 'done';
    }));
    await expect(heading(page)).toHaveText('Review');
    await expect(side(page)).toContainText('A new reason.');
    await expect(side(page).locator('.facts')).toContainText('Done');
    await expect(ringOf(page, 'review')).toHaveCSS('stroke', g);
  });

  await test.step('the side bar closes when the picked step is gone', async () => {
    await save(page, edit(full, c => {
      const main = c.branches[0];
      main.items = main.items.filter(it => !('id' in it && it.id === 'review'));
      delete nodeOf(c, 'launch').waitsFor;
    }));
    await expect(step(page, 'review')).toHaveCount(0);
    await expect(side(page)).toBeHidden();
    await expect(page.locator('svg.plan .picked')).toHaveCount(0);
    await save(page, full);
  });

  await test.step("'Back' shows what the side bar showed before, until it closes", async () => {
    const back = side(page).getByRole('button', { name: 'Back' }), quad = part(page, 'Blocked by').locator('.row', { hasText: 'Quad four' });
    await step(page, 'review').click();
    await expect(heading(page)).toHaveText('Review');
    await expect(back).toHaveCount(0);
    await quad.click();
    await expect(heading(page)).toHaveText('Quad four');
    await expect(back).toHaveAttribute('title', 'Back to Review');
    await back.click();
    await expect(heading(page)).toHaveText('Review');
    await expect(back).toHaveCount(0);
    await quad.click();
    await expect(heading(page)).toHaveText('Quad four');
    await page.keyboard.press('Escape');
    await step(page, 'review').click();
    await expect(heading(page)).toHaveText('Review');
    await expect(back).toHaveCount(0);
    await page.keyboard.press('Escape');
  });
});

test('the picked thing stays clear of the side bar', async ({ page }) => {
  await atTracks(page);

  await test.step('a picked step on the right stays clear through a zoom', async () => {
    await step(page, 'spin-1').click();
    await clearOfSide(page, step(page, 'spin-1'));
    // out, and back in
    for (const at of ['Main steps', 'Tracks']) {
      await zoomTo(page, at);
      await clearOfSide(page, step(page, 'spin-1'));
    }
    await page.keyboard.press('Escape');
  });

  await test.step('a step picked from a row of the side bar stays clear', async () => {
    await caption(page, 'Main').click();
    await row(page, 'Launch').click();
    await clearOfSide(page, step(page, 'launch'));
  });

  await test.step('a picked step stays clear of the side bar after a save', async () => {
    await save(page, edit(full, c => { nodeOf(c, 'launch').why = 'Ship it.'; }));
    await expect(side(page)).toContainText('Ship it.');
    await clearOfSide(page, step(page, 'launch'));
    await page.keyboard.press('Escape');
  });

  await test.step('a branch on the right of a plan that fits stays clear', async () => {
    await caption(page, 'Dead end').click();
    await clearOfSide(page, caption(page, 'Dead end'));
    await page.keyboard.press('Escape');
  });

  await test.step('a picked step stays clear after the window gets smaller', async () => {
    await step(page, 'review').click();
    await page.setViewportSize({ width: 1100, height: 800 });
    await settle(page);
    await clearOfSide(page, step(page, 'review'));
  });
});

test('a fitting plan drags clear of the side bar, then fits again', async ({ page }) => {
  await test.step('the part under the side bar drags clear of it', async () => {
    // the plan 'wordy' fits the window at 'Tracks', and runs under the side bar
    await openPlan(page, wordy, { store: 'side.wordy', kept: { level: 1, id: 'w-1', fx: 0.5, fy: 0.5 } });
    expect(await level(page)).toBe('Tracks');
    const stage = page.locator('.stage');
    await expect(stage, 'the level fits').toHaveCSS('overflow', 'hidden');
    await step(page, 'w-1').click();
    const end = step(page, 'w-8'), s = (await side(page).boundingBox())!;
    expect((await end.boundingBox())!.x, 'the last step lies under the side bar').toBeGreaterThan(s.x);
    // it scrolls, so a swipe of a touchpad moves it too
    await expect(stage).not.toHaveCSS('overflow', 'hidden');
    await page.mouse.move(900, 300);
    await page.mouse.down();
    await page.mouse.move(100, 300, { steps: 4 });
    await page.mouse.up();
    await clearOfSide(page, end);
  });

  await test.step('the plan fits again once the side bar closes', async () => {
    const stage = page.locator('.stage');
    await page.keyboard.press('Escape');
    await expect(stage).toHaveCSS('overflow', 'hidden');
    await expect.poll(() => stage.evaluate(e => e.scrollLeft)).toBe(0);
  });
});

test('with motion, a step at the far right glides clear', async ({ page }) => {
  await openPlan(page, full, { store: 'side.motion', kept: { level: 2, last: true, id: 'kickoff', fx: 0.5, fy: 0.5 }, motion: true });
  expect(await level(page)).toBe('Every step');
  await page.locator('.stage').evaluate(s => { s.scrollLeft = s.scrollWidth; });
  await settle(page);
  // the glide is a smooth scroll, in real time
  await step(page, 'spin-1').click();
  await clearOfSide(page, step(page, 'spin-1'));
});

test("'Links' lists each link of a step, and its heading folds it", async ({ page }) => {
  await test.step("'Links' comes before 'Why', with a row for each link", async () => {
    await openPlan(page, links, { store: null });
    await step(page, 'spec').click();
    await expect(parts(page)).toHaveText(['Links', 'Why']);
    await expect(linkRows(page)).toHaveText(['Spec doc', 'Demo', 'Mock']);
    for (const [i, url] of ['https://example.com/spec', 'http://example.com/demo', 'https://example.com/mock?v=2#top'].entries()) {
      await expect(linkRows(page).nth(i)).toHaveAttribute('href', url);
      await expect(linkRows(page).nth(i)).toHaveAttribute('target', '_blank');
      await expect(linkRows(page).nth(i)).toHaveAttribute('rel', 'noopener noreferrer');
    }
    await expect(linkRows(page).first().locator('.strong')).toHaveCSS('font-weight', '700');
  });

  await test.step('a link has its own icon, or the link icon', async () => {
    /** A part of the drawing of an icon of Tabler Icons, which tells it from the others. */
    const ART = { 'file-text': 'M14 3v4a1', link: 'm9 15l6-6' };
    const icons = await linkRows(page).evaluateAll(rs => rs.map(r => r.querySelector('svg')!.innerHTML));
    expect(icons[0]).toContain(ART['file-text']);
    expect(icons[1]).toContain(ART.link);
    expect(icons[2]).toContain(ART.link);
  });

  await test.step('the arrow follows the name, and no row scrolls sideways', async () => {
    const rows = await rowsOf(page, 'Links'), bar = await side(page).evaluate(e => ({ scroll: e.scrollWidth, width: e.clientWidth, right: e.getBoundingClientRect().right }));
    for (const r of rows) {
      expect(r.go!.left - r.strong!.right, r.name).toBeLessThanOrEqual(8.5);
      expect(r.go!.right, r.name).toBeLessThan(r.row.right - 40);
      expect(r.row.right, r.name).toBeLessThan(bar.right);
    }
    expect(bar.scroll).toBe(bar.width);
  });

  await test.step('a click opens the page in a new tab, with no opener', async () => {
    await page.context().route('https://example.com/**', r => r.fulfill({ contentType: 'text/html', body: '<title>Spec</title>' }));
    const [tab] = await Promise.all([page.context().waitForEvent('page'), linkRows(page).first().click()]);
    await tab.waitForLoadState();
    expect(tab.url()).toBe('https://example.com/spec');
    expect(await tab.evaluate(() => window.opener)).toBeNull();
    await tab.close();
    expect(page.url()).toMatch(/^file:/);
    await expect(linkRows(page)).toHaveCount(3);
  });

  await test.step("the heading folds 'Links', and turns its chevron", async () => {
    const chevron = fold(page).locator('svg');
    await expect(fold(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(chevron).toHaveCSS('transform', 'none');
    await fold(page).click();
    await expect(fold(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(linkRows(page)).toHaveCount(3);
    for (const r of await linkRows(page).all()) await expect(r).toBeHidden();
    // turned a fourth to the left: it points right
    await expect(chevron).toHaveCSS('transform', 'matrix(0, -1, 1, 0, 0, 0)');
    await expect(parts(page)).toHaveText(['Links', 'Why']);
  });

  await test.step("the next step's 'Links' stays folded, and Enter opens it", async () => {
    await step(page, 'build').click();
    await expect(heading(page)).toHaveText('Build');
    await expect(fold(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(linkRows(page).first()).toBeHidden();
    await fold(page).focus();
    await page.keyboard.press('Enter');
    await expect(fold(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(linkRows(page)).toHaveText(['Branch']);
    await expect(linkRows(page).first()).toBeVisible();
  });

  await test.step("a step with no link, or an empty list, has no 'Links'", async () => {
    await step(page, 'ship').click();
    await expect(heading(page)).toHaveText('Ship');
    await expect(parts(page)).toHaveText(['Why']);
    await step(page, 'party').click();
    await expect(heading(page)).toHaveText('Party');
    await expect(fold(page)).toHaveCount(0);
  });
});

test('a long name fits the side bar, which never scrolls sideways', async ({ page }) => {
  for (const size of SIZES) {
    const at = `${size.width}x${size.height}`;
    await test.step(`${at}: a 'Blocked by' row cuts its name at 2 lines`, async () => {
      if (size === SIZES[0]) {
        // 'Beta' as well, for the plan 'short'
        await openPlan(page, long, { store: 'side.long', kept: hiding(BETA, 'Beta') });
      } else {
        // the same page at a new size, on the plan 'long' again
        await save(page, long);
        await page.setViewportSize(size);
        await settle(page);
      }
      await step(page, 'long-text').click();
      await expect(heading(page)).toHaveText(nodeOf(long, 'long-text').name);
      const rows = await rowsOf(page, 'Blocked by');
      expect(rows.map(r => r.name)).toEqual(['Remember the view design: zoom, pan, the picked step and open parts stay after a reload', 'HTML export design for strangers who get one file by email and open it from their disk']);
      for (const r of rows) {
        expect(r.lines, r.name).toBeLessThanOrEqual(2);
        expect(r.cut, `${r.name} is cut`).toBe(true);
        expect(r.nm.right, r.name).toBeLessThanOrEqual(r.row.right);
      }
      // the pill of the hidden branch: one line, cut, and at most half the row
      const gone = rows[1].gone!;
      expect(gone.cut, 'the name in the pill is cut').toBe(true);
      expect(gone.width).toBeLessThanOrEqual(gone.room / 2 + 0.5);
      expect(gone.right).toBeLessThanOrEqual(rows[1].row.right);
      // a click on a step on the plan shows its whole name, so its row has no tip; the row of a step in a hidden branch has the name of the step and of its branch
      expect(rows[0].title, `the tip of ${rows[0].name}`).toBeNull();
      await expect(side(page).locator('.part .row.off')).toHaveAttribute('title', `${rows[1].name}\n${BETA}`);
    });

    await test.step(`${at}: links take one line, and a cut link has a tip`, async () => {
      const rows = await rowsOf(page, 'Links'), all = nodeOf(long, 'long-text').links!;
      expect(rows.map(r => r.name)).toEqual(all.map(l => l.name));
      for (const r of rows) {
        expect(r.lines, r.name).toBe(1);
        expect(r.go!.left - r.nm.right, `the arrow of ${r.name}`).toBeGreaterThanOrEqual(0);
        expect(r.go!.left - r.nm.right, `the arrow of ${r.name}`).toBeLessThanOrEqual(8.5);
        expect(r.go!.right, `the arrow of ${r.name}`).toBeLessThanOrEqual(r.row.right);
        expect(r.title, `the tip of ${r.name}`).toBe(r.cut ? r.name : null);
      }
      expect(rows.filter(r => r.cut).map(r => r.name)).toContain(all[3].name);
      expect(rows.filter(r => !r.cut).map(r => r.name)).toContain('Issue 41');
    });

    await test.step(`${at}: the path wraps between words`, async () => {
      const crumbs = await side(page).locator('.path .crumb').evaluateAll(cs => cs.map(c => ({ name: c.textContent, rects: [...c.getClientRects()].map(r => ({ top: r.top, right: r.right })) })));
      const path = (await side(page).locator('.path').boundingBox())!;
      expect(crumbs.map(c => c.name)).toEqual(['v1.0.0', BRANCH]);
      expect(Math.abs(crumbs[1].rects[0].top - crumbs[0].rects[0].top), 'the long name starts on the line of v1.0.0').toBeLessThan(1);
      for (const c of crumbs) for (const r of c.rects) expect(r.right, c.name!).toBeLessThanOrEqual(path.x + path.width + 0.5);
    });

    await test.step(`${at}: the side bar scrolls down to its last part, never sideways`, async () => {
      expect(await sideways(page)).toEqual(STILL);
      const bar = await side(page).evaluate(e => ({ scroll: e.scrollHeight, height: e.clientHeight, overflow: getComputedStyle(e).overflowY }));
      expect(bar.overflow).toBe('auto');
      expect(bar.scroll).toBeGreaterThan(bar.height);
      const last = side(page).locator('section.part').last();
      await expect(last.locator('h3')).toHaveText('Done when');
      await side(page).evaluate(e => { e.scrollTop = e.scrollHeight; });
      const s = (await side(page).boundingBox())!, l = (await last.boundingBox())!;
      expect(l.y + l.height).toBeLessThanOrEqual(s.y + s.height);
      expect(await sideways(page)).toEqual(STILL);
    });

    await test.step(`${at}: a hidden step with whole names has no browser tip`, async () => {
      await save(page, short);
      await expect(side(page).locator('.part .row.off .nm')).toHaveText('Export');
      // the tips are set: a cut link has its tip
      await expect(side(page).locator('a.row[title]').first()).toBeAttached();
      const off = (await rowsOf(page, 'Blocked by'))[1];
      expect(off.name).toBe('Export');
      expect(off.cut, 'the name is cut').toBe(false);
      expect(off.gone!.cut, 'the name in the pill is cut').toBe(false);
      expect(off.title).toBeNull();
    });

    await test.step(`${at}: keys reach each crumb, and 'In it' keeps its count whole`, async () => {
      await side(page).evaluate(e => { e.scrollTop = 0; });
      await crumb(page, BRANCH).focus();
      await expect(crumb(page, BRANCH)).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(heading(page)).toHaveText(BRANCH);
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
      await expect(heading(page)).toHaveText('v1.0.0');
      expect(await sideways(page)).toEqual(STILL);
    });
  }
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

  test('a tapped pill under the sheet glides clear of it', async ({ page }) => {
    // the tracks 'Code' of four builds one under the other: their sheets are as high as each other
    await openPlan(page, columns('One-d'), { store: null, clock: true });
    await pickLayout(page, 'Horizontal');
    await toolsButton(page).tap();
    await zoomTo(page, 'Tracks');
    const keys = await page.evaluate(() => {
      const shown = (e: Element | null): boolean => !!e && getComputedStyle(e).display !== 'none';
      return [...document.querySelectorAll<SVGTextElement>('svg.plan text.cap')].filter(t => t.textContent === 'Code' && shown(t) && shown(document.querySelector(`svg.plan rect.zbar[data-bar="${t.dataset.bar}"]`)))
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).map(t => t.dataset.bar!);
    });
    const name = (k: string): Locator => page.locator(`svg.plan text.cap[data-bar="${k}"]`), pillOf = (k: string): Locator => page.locator(`svg.plan rect.zbar[data-bar="${k}"]`);
    // on a stopped clock: a tap picks 300 ms after it, as soon as the clock moves on
    await stopClock(page);
    const tap = async (k: string, holds: string): Promise<void> => {
      const b = (await pillOf(k).boundingBox())!;
      // on its upper part: the open sheet of the one before may lie over its lower part
      await page.touchscreen.tap(b.x + b.width / 2, b.y + 6);
      await play(page, 300);
      await expect(side(page)).toContainText(holds);
    };
    // the one of 'Three build', picked: its sheet says where the top of a sheet of a track 'Code' is
    const [x, y] = keys.slice(-2);
    await name(x).evaluate(e => e.scrollIntoView({ block: 'center', inline: 'center' }));
    await settle(page);
    await tap(x, 'Three code');
    const top = (await side(page).boundingBox())!.y;
    // the one of 'Four build': its name in the strip over the sheet, and its pill under the sheet, lower
    const cap = (await name(y).boundingBox())!;
    await page.locator('.roadmap .stage').evaluate((s, by) => s.scrollBy(0, by), cap.y + cap.height - (top - 26));
    await settle(page);
    const was = (await pillOf(y).boundingBox())!, capWas = (await name(y).boundingBox())!;
    expect(capWas.y + capWas.height, 'the name in the strip').toBeLessThan(top - 24);
    expect(was.y + was.height, 'the pill under the sheet').toBeGreaterThan(top);
    await tap(y, 'Four code');
    const p = (await pillOf(y).boundingBox())!, sheet = (await side(page).boundingBox())!;
    expect(Math.abs(sheet.y - top), 'a sheet about as high').toBeLessThan(10);
    expect(p.y + p.height, 'the pill clear of the sheet').toBeLessThanOrEqual(sheet.y + 0.5);
  });

  test('by touch, a hidden step and each link show whole names', async ({ page }) => {
    // a touch shows no browser tip, so where nothing points without a touch, no row that relies on the tip cuts its text
    for (const size of SIZES) {
      await test.step(`at ${size.width}x${size.height}, no name is cut and no row has a tip`, async () => {
        await page.setViewportSize(size);
        if (size === SIZES[0]) await openPlan(page, long, { store: 'side.touch', kept: hiding(BETA) });
        else await settle(page);
        await step(page, 'long-text').click();
        await expect(heading(page)).toHaveText(nodeOf(long, 'long-text').name);
        const off = (await rowsOf(page, 'Blocked by'))[1];
        expect(off.name).toBe(nodeOf(long, 'html-export-design').name);
        expect(off.cut, 'the name is cut').toBe(false);
        expect(off.lines, 'the lines of the name').toBeGreaterThan(2);
        expect(off.gone!.cut, 'the name in the pill is cut').toBe(false);
        expect(off.gone!.width).toBeLessThanOrEqual(off.gone!.room / 2 + 0.5);
        expect(off.gone!.right).toBeLessThanOrEqual(off.row.right);
        expect(off.title).toBeNull();
        await expect(side(page).locator('.row.off .gone')).toHaveText(BETA);

        const rows = await rowsOf(page, 'Links');
        expect(rows.map(r => r.name)).toEqual(nodeOf(long, 'long-text').links!.map(l => l.name));
        for (const r of rows) {
          expect(r.cut, `${r.name} is cut`).toBe(false);
          expect(r.title, `the tip of ${r.name}`).toBeNull();
          expect(r.go!.left, `the arrow of ${r.name}`).toBeGreaterThanOrEqual(r.nm.right);
          expect(r.go!.right, `the arrow of ${r.name}`).toBeLessThanOrEqual(r.row.right);
        }
        expect(rows.find(r => r.name === nodeOf(long, 'long-text').links![3].name)!.lines, 'the lines of a long address').toBeGreaterThan(1);
        expect(await sideways(page)).toEqual(STILL);
      });
    }
  });

  test("'Links' grows the sheet, and a double tap on it opens nothing", async ({ page }) => {
    /** Where the step 'Spec' and the top of the sheet are, up and down. */
    const look = () => page.evaluate(() => ({
      bottom: document.querySelector('svg.plan g.zn[data-id="spec"]')!.getBoundingClientRect().bottom,
      sheet: document.querySelector('.side')!.getBoundingClientRect().top,
    }));
    let closed = { bottom: 0, sheet: 0 };
    await test.step('a tapped step sits clear of the closed sheet', async () => {
      await page.context().route('https://example.com/**', r => r.fulfill({ contentType: 'text/html', body: '<title>Spec</title>' }));
      // 'Spec' a little over the top of the sheet with 'Links' closed: the open sheet reaches over where it was.
      // On a stopped clock: the page reads the two taps on 'Links' as 120 ms apart however long it takes over each
      await openPlan(page, links, { store: 'side.links', kept: { level: 0, id: 'spec', fx: 0.5, fy: 0.4, links: false }, clock: true });
      await stopClock(page);
      await step(page, 'spec').tap();
      // a tap picks 300 ms after it
      await play(page, 300);
      await expect(side(page)).toBeVisible();
      closed = await look();
      expect(closed.bottom, 'clear of the closed sheet').toBeLessThanOrEqual(closed.sheet);
    });

    await test.step("a second tap on 'Links' lands on a link, which opens nothing", async () => {
      // each click on a link, once the page has heard it: its name, and whether the page let it open its page
      await page.evaluate(() => {
        const w = window as unknown as { links: string[] };
        w.links = [];
        window.addEventListener('click', e => {
          const a = (e.target as Element).closest('a.row');
          if (a) w.links.push(`${a.textContent} ${e.defaultPrevented ? 'stopped' : 'opened'}`);
        });
      });
      const at = (await fold(page).boundingBox())!, x = at.x + at.width / 2, y = at.y + at.height / 2;
      await page.touchscreen.tap(x, y);
      await expect(fold(page)).toHaveAttribute('aria-expanded', 'true');
      expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('a.row')?.textContent, [x, y]), 'a link under the finger').toBe('Spec doc');
      await page.clock.runFor(120);
      await page.touchscreen.tap(x, y);
      await expect.poll(() => page.evaluate(() => (window as unknown as { links: string[] }).links), 'the second tap, on the link').toEqual(['Spec doc stopped']);
      expect(page.context().pages()).toHaveLength(1);
      await expect(fold(page)).toHaveAttribute('aria-expanded', 'true');
    });

    await test.step("the open 'Links' makes the sheet taller, and the step moves clear", async () => {
      await play(page, 1000);
      const opened = await look();
      expect(opened.sheet, 'the open sheet over where the step was').toBeLessThan(closed.bottom);
      expect(opened.bottom, 'clear of the open sheet').toBeLessThanOrEqual(opened.sheet);
    });
  });
});
