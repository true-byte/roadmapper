// The list of top-level branches, left of the tools button: each row shows or hides its branch, and the search finds rows by name.
// A finished branch is hidden at first; a step that waits for one in a hidden branch names it with a pill; the level, the place and a save keep what shows.
import type { Locator, Page } from '@playwright/test';
import type { Roadmap } from '../../src/roadmap/types';
import { caption, errorList, expect, level, openPlan, openTools, play, popup, reload, save, settle, side, step, stopClock, stored, test, toolsButton, zoomTo } from '../support/helpers';
import { edit, flat, long, nodeOf, nodesOf, plain, versions } from '../support/plans';

const LONG = versions.branches[3].name!;
/** The button left of the tools button that opens the list. */
const layers = (page: Page): Locator => page.locator('.zoom').getByRole('button', { name: 'Branches', exact: true });
const list = (page: Page): Locator => page.getByRole('dialog', { name: 'Branches', includeHidden: true });
/** The row of a branch in the list, by its tag: its name where that is unique. */
const row = (page: Page, name: string): Locator => list(page).locator(`[data-tag="${name}"]`);
/** What each row says, in its order: its name, whether its branch shows, and how many of its steps are done. */
const rows = (page: Page): Promise<{ name: string; on: string | null; done: string }[]> =>
  list(page).locator('[data-tag]').evaluateAll(bs => bs.map(b => ({ name: b.querySelector('.name')!.textContent!, on: b.getAttribute('aria-checked'), done: b.querySelector('.dim')!.textContent! })));
async function openList(page: Page): Promise<void> {
  if (await list(page).isHidden()) await layers(page).click();
  await expect(list(page)).toBeVisible();
}
/** Shows or hides a branch with its row, and waits for the plan to rest. `force` presses a row that says it is disabled. */
async function flip(page: Page, name: string, force = false): Promise<void> {
  await openList(page);
  await row(page, name).click({ force });
  await settle(page);
}
/** Each row of the list: its name, the lines it takes, whether it is cut, the lines of its count, and whether the count ends inside the row. And how far the page, the side bar and the list scroll sideways. */
const longRows = (page: Page): Promise<{ rows: { name: string | null; lines: number; cut: boolean; dim: number; inside: boolean }[]; sideways: number[] }> =>
  page.evaluate(() => {
    const rows = [...document.querySelectorAll('.branches .pick')].map(p => {
      const nm = p.querySelector('.name')!, dim = p.querySelector('.dim')!, lines = (e: Element): number => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight));
      return { name: nm.textContent, lines: lines(nm), cut: nm.scrollHeight > nm.clientHeight + 1, dim: lines(dim), inside: dim.getBoundingClientRect().right <= p.getBoundingClientRect().right };
    });
    const over = (e: Element | null): number => (e ? e.scrollWidth - e.clientWidth : 0);
    return { rows, sideways: [document.documentElement.scrollWidth - window.innerWidth, over(document.body), over(document.querySelector('.side')), over(document.querySelector('.branches'))] };
  });
/** The long names of 'long' on 2 lines at most, cut where they do not fit, each count on one line inside its row, and nothing scrolls sideways. */
async function longNamesFit(page: Page, cut: string[]): Promise<void> {
  await save(page, long);
  await openList(page);
  const got = await longRows(page);
  expect(got.rows.map(r => r.name)).toEqual(long.branches.map(b => b.name));
  for (const r of got.rows) expect([r.lines <= 2, r.dim, r.inside], r.name!).toEqual([true, 1, true]);
  expect(got.rows.filter(r => r.cut).map(r => r.name), 'cut with "…"').toEqual(cut);
  expect(got.sideways, 'nothing scrolls sideways').toEqual([0, 0, 0, 0]);
}

/** 'Work', a branch with a group, so three levels, and 'Flat', a branch of steps only. */
const grouped: Roadmap = { title: 'Grouped plan', branches: [plain.branches[0], { name: 'Flat', items: [{ id: 'fl-1', name: 'Flat one' }, { id: 'fl-2', name: 'Flat two' }] }] };

test('the list shows and hides top-level branches', async ({ page }) => {
  await openPlan(page, versions);

  await test.step('a finished top-level branch is hidden at first, its steps uncounted', async () => {
    await expect(caption(page, 'Old')).toHaveCount(0);
    await expect(step(page, 'o-1')).toHaveCount(0);
    await expect(caption(page, 'Now')).toBeVisible();
    await expect(step(page, 'x-1')).toBeVisible();
    await expect(page.locator('.roadmap .progress')).toHaveText('0 of 4 steps done');
    await expect(list(page)).toBeHidden();
    await expect(layers(page)).toHaveAttribute('aria-expanded', 'false');
    // left of the tools button, which stays the last button
    const at = (await layers(page).boundingBox())!, key = (await toolsButton(page).boundingBox())!;
    expect(at.x + at.width).toBeLessThanOrEqual(key.x);
  });

  await test.step('the list holds every branch in file order, what shows ticked', async () => {
    await openList(page);
    await expect(layers(page)).toHaveAttribute('aria-expanded', 'true');
    expect(await rows(page)).toEqual([
      { name: 'Old', on: 'false', done: '1/1' },
      { name: 'Now', on: 'true', done: '0/2' },
      { name: 'Next', on: 'true', done: '0/1' },
      { name: LONG, on: 'true', done: '0/1' },
    ]);
    // over the zoom control, clear of the grip, its right edge on the control's
    const bar = (await page.locator('.roadmap .zoom').boundingBox())!, box = (await list(page).boundingBox())!;
    expect(bar.y - (box.y + box.height)).toBeCloseTo(30, 0);
    expect(Math.abs(box.x + box.width - (bar.x + bar.width))).toBeLessThan(1);
    // a long name takes two lines at most, and the row tells it whole
    const name = row(page, LONG).locator('.name'), lineH = await name.evaluate(e => parseFloat(getComputedStyle(e).lineHeight));
    expect((await name.boundingBox())!.height).toBeLessThanOrEqual(2 * lineH + 1);
    await expect(row(page, LONG)).toHaveAttribute('title', LONG);
  });

  await test.step('a row shows or hides its branch, and the page keeps it', async () => {
    await flip(page, 'Old');
    await expect(caption(page, 'Old')).toBeVisible();
    await expect(step(page, 'o-1')).toBeVisible();
    // its steps count again: 'Old two' is canceled, so it counts as none
    await expect(page.locator('.roadmap .progress')).toHaveText('1 of 5 steps done');
    await expect(row(page, 'Old')).toHaveAttribute('aria-checked', 'true');
    await expect(list(page), 'the list stays open').toBeVisible();
    expect((await stored(page))?.branches).toEqual({ Old: true });
    await flip(page, 'Next');
    await expect(caption(page, 'Next')).toHaveCount(0);
    await expect(step(page, 'x-1')).toHaveCount(0);
    expect((await stored(page))?.branches).toEqual({ Old: true, Next: false });
    await reload(page);
    await expect(caption(page, 'Old')).toBeVisible();
    await expect(caption(page, 'Next')).toHaveCount(0);
    await flip(page, 'Old');
    await flip(page, 'Next');
    await expect(caption(page, 'Old')).toHaveCount(0);
    await expect(caption(page, 'Next')).toBeVisible();
    expect((await stored(page))?.branches, 'a choice that is the default is not kept').toEqual({});
  });

  await test.step('the last branch that shows cannot be hidden', async () => {
    await flip(page, 'Now');
    await flip(page, 'Next');
    await expect(row(page, LONG)).toHaveAttribute('aria-disabled', 'true');
    await flip(page, LONG, true);
    await expect(row(page, LONG)).toHaveAttribute('aria-checked', 'true');
    await expect(step(page, 'l-1')).toBeVisible();
    await flip(page, 'Now');
    await expect(row(page, LONG)).toHaveAttribute('aria-disabled', 'false');
    await flip(page, 'Next');
  });

  await test.step('the search finds rows by name, in any case, and starts empty', async () => {
    await page.keyboard.press('Escape');
    await openList(page);
    const find = list(page).getByRole('searchbox', { name: 'Search' });
    await expect(find).toBeFocused();
    await find.fill('NEX');
    expect((await rows(page)).map(r => r.name)).toEqual(['Next']);
    await find.fill('zzz');
    expect(await rows(page)).toEqual([]);
    await find.press('Escape');
    await expect(list(page), 'Escape in the search closes the list').toBeHidden();
    await expect(layers(page), 'the focus goes back to the button').toBeFocused();
    await openList(page);
    await expect(find).toHaveValue('');
    expect(await rows(page)).toHaveLength(4);
  });

});

test('the list closes first, and a hidden branch shows as a pill', async ({ page }) => {
  await openPlan(page, versions, { store: null });

  await test.step('Escape or a press on the plan closes the list first', async () => {
    await step(page, 'w-1').click();
    await expect(side(page)).toBeVisible();
    await openList(page);
    await expect(side(page), 'on a laptop the side bar stays').toBeVisible();
    await page.keyboard.press('Escape');
    await expect(list(page)).toBeHidden();
    await expect(side(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(side(page)).toBeHidden();
    await openList(page);
    await step(page, 'w-1').click();
    await expect(list(page)).toBeHidden();
    await expect(side(page), 'the press only closed the list').toBeHidden();
  });

  await test.step('the popup and the list close each other', async () => {
    await openList(page);
    await openTools(page);
    await expect(list(page)).toBeHidden();
    await layers(page).click();
    await expect(list(page)).toBeVisible();
    await expect(popup(page)).toBeHidden();
    await page.keyboard.press('Escape');
  });

  await test.step('a row press leaves the list and the side bar open', async () => {
    await step(page, 'w-1').click();
    await flip(page, 'Old');
    await expect(list(page)).toBeVisible();
    await expect(side(page)).toBeVisible();
    await expect(row(page, 'Old')).toHaveAttribute('aria-checked', 'true');
    // from the keyboard, the pressed row keeps the focus
    await row(page, 'Old').focus();
    await page.keyboard.press('Enter');
    await settle(page);
    await expect(row(page, 'Old')).toHaveAttribute('aria-checked', 'false');
    await expect(row(page, 'Old')).toBeFocused();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(side(page)).toBeHidden();
  });

  await test.step('a blocker in a hidden branch has the pill of its branch', async () => {
    await step(page, 'x-1').click();
    const blocker = side(page).locator('.row', { hasText: 'Now two' });
    await expect(blocker.locator('.gone')).toHaveCount(0);
    await expect(side(page).getByRole('button', { name: 'Show only blockers' })).toBeVisible();
    await page.keyboard.press('Escape');
    await flip(page, 'Now');
    await page.keyboard.press('Escape');
    await expect(list(page)).toBeHidden();
    await step(page, 'x-1').click();
    await expect(side(page)).toBeVisible();
    await expect(blocker.locator('.gone')).toHaveText('Now');
    expect(await blocker.evaluate(e => e.tagName), 'a row that answers no click').toBe('DIV');
    await expect(side(page).getByRole('button', { name: 'Show only blockers' })).toHaveCount(0);
    await blocker.hover();
    await expect(page.locator('.roadmap .aim .ring'), 'it answers no pointer').toBeHidden();
    await expect(page.locator('.roadmap .aim .arrow')).toBeHidden();
    await flip(page, 'Next');
    await expect(side(page), 'a picked step whose branch hides closes the side bar').toBeHidden();
  });

});

test('a save keeps the branches shown or hidden', async ({ page }) => {
  await openPlan(page, versions);

  await test.step('a save keeps the branches shown or hidden, past a broken save', async () => {
    await flip(page, 'Next');
    await save(page, edit(versions, p => { nodeOf(p, 'w-1').name = 'Now one, renamed'; }));
    await expect(caption(page, 'Next')).toHaveCount(0);
    await expect(row(page, 'Next')).toHaveAttribute('aria-checked', 'false');
    await save(page, '{ "title": ');
    await expect(errorList(page)).toBeVisible();
    await save(page, versions);
    await expect(errorList(page)).toBeHidden();
    await expect(caption(page, 'Next')).toHaveCount(0);
    await expect(row(page, 'Next')).toHaveAttribute('aria-checked', 'false');
    await flip(page, 'Next');
  });

  await test.step("'Show only blockers' keeps only the blockers that show", async () => {
    await flip(page, 'Now');
    await save(page, edit(versions, p => { nodeOf(p, 'x-1').waitsFor = ['w-2', 'l-1']; }));
    await page.keyboard.press('Escape');
    await step(page, 'x-1').click();
    await expect(side(page).locator('.row', { hasText: 'Now two' }).locator('.gone')).toHaveText('Now');
    await side(page).getByRole('button', { name: 'Show only blockers' }).click();
    await settle(page);
    await expect(page.locator('.roadmap.only')).toHaveCount(1);
    await expect(step(page, 'l-1')).toHaveClass(/keep/);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await settle(page);
    await flip(page, 'Now');
    expect((await stored(page))?.branches).toEqual({});
  });

  await test.step('where all branches are finished, the last one shows', async () => {
    await save(page, edit(versions, p => { for (const n of nodesOf(p)) n.state = 'done'; delete nodeOf(p, 'x-1').waitsFor; }));
    await openList(page);
    expect((await rows(page)).map(r => r.on)).toEqual(['false', 'false', 'false', 'true']);
    await flip(page, 'Old');
    expect((await rows(page)).map(r => r.on), 'showing another keeps it').toEqual(['true', 'false', 'false', 'true']);
    await expect(step(page, 'l-1')).toBeVisible();
  });

  await test.step("branches named '#2' or alike each have a row of their own", async () => {
    await save(page, { title: 'Clash', branches: [{ name: '#2', items: [{ id: 'c-1', name: 'C one' }] }, { name: 'X', items: [{ id: 'c-2', name: 'C two' }] }, { name: 'X', items: [{ id: 'c-3', name: 'C three' }] }] });
    await openList(page);
    const tags = await list(page).locator('[data-tag]').evaluateAll(bs => bs.map(b => b.getAttribute('data-tag')));
    expect(new Set(tags).size).toBe(3);
    await list(page).locator('[data-tag]').nth(1).click();
    await settle(page);
    await expect(step(page, 'c-1')).toBeVisible();
    await expect(step(page, 'c-2')).toHaveCount(0);
    await expect(step(page, 'c-3')).toBeVisible();
  });

});

test('the level and the place stay, and long names fit the list', async ({ page }) => {
  await openPlan(page, grouped);

  await test.step('the level and the place stay as a branch shows or hides', async () => {
    await zoomTo(page, 'Tracks');
    const before = (await step(page, 'p-1').boundingBox())!;
    await flip(page, 'Flat');
    expect(await level(page)).toBe('Tracks');
    const after = (await step(page, 'p-1').boundingBox())!;
    expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y), 'the step stays put').toBeLessThan(1);
    await flip(page, 'Flat');
    // 'Work' holds the only group: hidden, the plan has one level
    await flip(page, 'Work');
    expect(await page.locator('.zoom .stop').count()).toBe(1);
    await flip(page, 'Work');
    expect(await level(page), 'the level comes back with the branch').toBe('Tracks');
    expect((await stored(page))?.level).toBe(1);
  });

  await test.step('the list cuts a long name after 2 lines, its count whole', async () => {
    await page.keyboard.press('Escape');
    await longNamesFit(page, [long.branches[0].name!, long.branches[1].name!]);
  });

  await test.step('a plan of one top-level branch has no button for the list', async () => {
    await save(page, flat);
    await expect(layers(page)).toBeHidden();
    await expect(toolsButton(page)).toBeVisible();
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

  test('a finger opens the list as wide as the view', async ({ page }) => {
    // the clock keeps the real time, but for the wait of a tap
    await openPlan(page, versions, { store: null, clock: true });

    await test.step('the list spans the view less 8 px, the search unfocused', async () => {
      await layers(page).tap();
      await expect(list(page)).toBeVisible();
      const box = (await list(page).boundingBox())!, bar = (await page.locator('.roadmap .zoom').boundingBox())!;
      expect(box.x).toBeCloseTo(8, 0);
      expect(box.width).toBeCloseTo(390 - 16, 0);
      expect(bar.y - (box.y + box.height), 'over the zoom control').toBeCloseTo(30, 0);
      // no keyboard comes up over the list
      await expect(list(page).getByRole('searchbox')).not.toBeFocused();
      // the zoom control still fits the phone with the button
      expect(bar.x).toBeGreaterThanOrEqual(0);
      expect(bar.x + bar.width).toBeLessThanOrEqual(390);
      await layers(page).tap();
      await expect(list(page)).toBeHidden();
    });

    await test.step("a tap on 'Branches' closes the sheet of a picked step", async () => {
      // a tap waits 300 ms before it picks: on the stopped clock, until play()
      await stopClock(page);
      await step(page, 'w-1').tap();
      await play(page, 400);
      await page.clock.resume();
      await expect(side(page)).toBeVisible();
      await layers(page).tap();
      await expect(list(page)).toBeVisible();
      await expect(side(page)).toBeHidden();
      await layers(page).tap();
      await expect(list(page)).toBeHidden();
    });

    await test.step('held sideways, a finger opens the list, the search unfocused', async () => {
      await page.setViewportSize({ width: 844, height: 390 });
      await settle(page);
      await layers(page).tap();
      await expect(list(page)).toBeVisible();
      await expect(list(page).getByRole('searchbox')).not.toBeFocused();
      await layers(page).tap();
    });

    await test.step('phone-wide, the list fits each long name on 2 lines', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await settle(page);
      await longNamesFit(page, []);
    });
  });
});
