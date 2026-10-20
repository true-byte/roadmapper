// Show and hide: the list of top-level branches left of (i), a step that waits for one in a hidden branch, and the grip that hides the zoom control.
import type { Locator, Page } from '@playwright/test';
import { caption, errorList, expect, keyButton, level, openKey, openPlan, popup, reload, save, settle, side, step, stored, test, zoomTo } from './helpers';
import { edit, flat, full, nodeOf, nodesOf, plain, versions } from './plans';

const LONG = versions.branches[3].name!;
/** The button left of (i) that opens the list. */
const layers = (page: Page): Locator => page.locator('.zoom').getByRole('button', { name: 'Branches', exact: true });
/** The list of top-level branches. */
const list = (page: Page): Locator => page.getByRole('dialog', { name: 'Branches', includeHidden: true });
/** The row of a branch in the list, by its name. */
const row = (page: Page, name: string): Locator => list(page).locator(`[data-tag="${name}"]`);
/** What each row of the list says, in its order: its name, whether its branch shows, and how many of its steps are done. */
const rows = (page: Page): Promise<{ name: string; on: string | null; done: string }[]> =>
  list(page).locator('[data-tag]').evaluateAll(bs => bs.map(b => ({ name: b.querySelector('.name')!.textContent!, on: b.getAttribute('aria-checked'), done: b.querySelector('.dim')!.textContent! })));
/** Opens the list with a click, and waits for it. */
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

test('a finished top-level branch is hidden at first; the head counts the steps of the branches that show; the list holds every branch in the order of the file, with what shows ticked', async ({ page }) => {
  await openPlan(page, versions, { store: null });
  await expect(caption(page, 'Old')).toHaveCount(0);
  await expect(step(page, 'o-1')).toHaveCount(0);
  await expect(caption(page, 'Now')).toBeVisible();
  await expect(step(page, 'x-1')).toBeVisible();
  await expect(page.locator('.roadmap .progress')).toHaveText('0 of 4 steps done');
  await expect(list(page)).toBeHidden();
  await expect(layers(page)).toHaveAttribute('aria-expanded', 'false');
  // left of (i), which stays the last button
  const at = (await layers(page).boundingBox())!, key = (await keyButton(page).boundingBox())!;
  expect(at.x + at.width).toBeLessThanOrEqual(key.x);
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

test('a row shows or hides its branch, and the list stays open; the page keeps a choice, but not one that is what the branch gets by default', async ({ page }) => {
  await openPlan(page, versions);
  await flip(page, 'Old');
  await expect(caption(page, 'Old')).toBeVisible();
  await expect(step(page, 'o-1')).toBeVisible();
  // its steps count again: 'Old two' is canceled, so it counts as none
  await expect(page.locator('.roadmap .progress')).toHaveText('1 of 5 steps done');
  await expect(row(page, 'Old')).toHaveAttribute('aria-checked', 'true');
  await expect(list(page)).toBeVisible();
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
  expect((await stored(page))?.branches).toEqual({});
});

test('the last branch that shows cannot be hidden', async ({ page }) => {
  await openPlan(page, versions, { store: null });
  await flip(page, 'Now');
  await flip(page, 'Next');
  await expect(row(page, LONG)).toHaveAttribute('aria-disabled', 'true');
  await flip(page, LONG, true);
  await expect(row(page, LONG)).toHaveAttribute('aria-checked', 'true');
  await expect(step(page, 'l-1')).toBeVisible();
  await flip(page, 'Now');
  await expect(row(page, LONG)).toHaveAttribute('aria-disabled', 'false');
});

test('the search finds rows by their name, in any case, and is empty each time the list opens; Escape in it closes the list, and the focus goes back to the button', async ({ page }) => {
  await openPlan(page, versions, { store: null });
  await openList(page);
  const find = list(page).getByRole('searchbox', { name: 'Search' });
  await expect(find).toBeFocused();
  await find.fill('NEX');
  expect((await rows(page)).map(r => r.name)).toEqual(['Next']);
  await find.fill('zzz');
  expect(await rows(page)).toEqual([]);
  await find.press('Escape');
  await expect(list(page)).toBeHidden();
  await expect(layers(page)).toBeFocused();
  await openList(page);
  await expect(find).toHaveValue('');
  expect(await rows(page)).toHaveLength(4);
});

test('Escape closes the list before the side bar; a press on the plan closes it and picks nothing; the popup and the list close each other', async ({ page }) => {
  await openPlan(page, versions, { store: null });
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
  await step(page, 'x-1').click();
  await expect(list(page)).toBeHidden();
  await expect(side(page), 'the press only closed the list').toBeHidden();
  await openList(page);
  await openKey(page);
  await expect(list(page)).toBeHidden();
  await layers(page).click();
  await expect(list(page)).toBeVisible();
  await expect(popup(page)).toBeHidden();
});

test("a step that waits for one in a hidden branch: the side bar names it with a pill of its branch, it answers no pointer, and there is no 'Show only blockers'; a picked step whose branch hides closes the side bar", async ({ page }) => {
  await openPlan(page, versions, { store: null });
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
  expect(await blocker.evaluate(e => e.tagName)).toBe('DIV');
  await expect(side(page).getByRole('button', { name: 'Show only blockers' })).toHaveCount(0);
  await blocker.hover();
  await expect(page.locator('.roadmap .aim .ring')).toBeHidden();
  await expect(page.locator('.roadmap .aim .arrow')).toBeHidden();
  // a picked step whose branch hides: the side bar closes
  await flip(page, 'Next');
  await expect(side(page)).toBeHidden();
});

test('a plan of one top-level branch has no button for the list', async ({ page }) => {
  await openPlan(page, flat, { store: null });
  await expect(layers(page)).toBeHidden();
  await expect(keyButton(page)).toBeVisible();
});

test('the grip hides the zoom control down to itself and brings it back: the popup closes, the keys still work, the buttons take no focus, and the page keeps it', async ({ page }) => {
  await openPlan(page, plain);
  const vh = page.viewportSize()!.height, bar = page.locator('.roadmap .zoom'), grip = page.locator('.roadmap .zoom .grip');
  await expect(grip).toHaveAttribute('aria-label', 'Hide toolbar');
  await openKey(page);
  await grip.click();
  await expect(popup(page)).toBeHidden();
  await expect(grip).toHaveAttribute('aria-label', 'Show toolbar');
  expect((await bar.boundingBox())!.y, 'the control under the bottom of the view').toBeGreaterThanOrEqual(vh - 0.5);
  const g = (await grip.boundingBox())!;
  // its open bottom, where it meets the control, may run 2 px under the edge
  expect(g.y + g.height, 'the grip at the bottom').toBeLessThanOrEqual(vh + 2.5);
  expect(g.y).toBeLessThan(vh - 20);
  expect(await keyButton(page).evaluate(e => (e as HTMLElement).inert)).toBe(true);
  await page.keyboard.press('+');
  await settle(page);
  expect(await level(page)).toBe('Tracks');
  expect((await stored(page))?.tucked).toBe(true);
  await reload(page);
  await expect(grip).toHaveAttribute('aria-label', 'Show toolbar');
  await grip.click();
  await expect(grip).toHaveAttribute('aria-label', 'Hide toolbar');
  const b = (await bar.boundingBox())!;
  expect(b.y + b.height).toBeCloseTo(vh - 20, 0);
  expect(await keyButton(page).evaluate(e => (e as HTMLElement).inert)).toBe(false);
  expect((await stored(page))?.tucked).toBe(false);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

  test('the list is as wide as the view less 8 px at each side, over the zoom control, and a finger opens it with no focus in the search, so no keyboard covers it', async ({ page }) => {
    await openPlan(page, versions, { store: null });
    await layers(page).tap();
    await expect(list(page)).toBeVisible();
    const box = (await list(page).boundingBox())!, bar = (await page.locator('.roadmap .zoom').boundingBox())!;
    expect(box.x).toBeCloseTo(8, 0);
    expect(box.width).toBeCloseTo(390 - 16, 0);
    expect(bar.y - (box.y + box.height)).toBeCloseTo(30, 0);
    await expect(list(page).getByRole('searchbox')).not.toBeFocused();
    // the zoom control still fits the phone with the button
    expect(bar.x).toBeGreaterThanOrEqual(0);
    expect(bar.x + bar.width).toBeLessThanOrEqual(390);
  });
});

/** 'Work', a branch with a group, so three levels, and 'Flat', a branch of steps only. */
const grouped = { title: 'Grouped plan', branches: [plain.branches[0], { name: 'Flat', items: [{ id: 'fl-1', name: 'Flat one' }, { id: 'fl-2', name: 'Flat two' }] }] };

test.describe('what a branch shown or hidden keeps', () => {
  test('the list stays open, and so does the side bar, when a row is pressed while a step is picked', async ({ page }) => {
    await openPlan(page, versions, { store: null });
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
  });

  test('the level, and the place of a step, stay; a level that a hidden branch took away comes back with it', async ({ page }) => {
    await openPlan(page, grouped);
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
    expect(await level(page)).toBe('Tracks');
    expect((await stored(page))?.level).toBe(1);
  });

  test('a save of the file keeps the branches shown or hidden, also past a broken save', async ({ page }) => {
    await openPlan(page, versions, { store: null });
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
  });

  test("'Show only blockers' keeps only the blockers that show", async ({ page }) => {
    await openPlan(page, edit(versions, p => { nodeOf(p, 'x-1').waitsFor = ['w-2', 'l-1']; }), { store: null });
    await flip(page, 'Now');
    await page.keyboard.press('Escape');
    await step(page, 'x-1').click();
    await expect(side(page).locator('.row', { hasText: 'Now two' }).locator('.gone')).toHaveText('Now');
    await side(page).getByRole('button', { name: 'Show only blockers' }).click();
    await settle(page);
    await expect(page.locator('.roadmap.only')).toHaveCount(1);
    await expect(step(page, 'l-1')).toHaveClass(/keep/);
  });

  test('where all branches are finished, the last one shows; showing another keeps it', async ({ page }) => {
    const over = edit(versions, p => { for (const n of nodesOf(p)) n.state = 'done'; delete nodeOf(p, 'x-1').waitsFor; });
    await openPlan(page, over, { store: null });
    await openList(page);
    expect((await rows(page)).map(r => r.on)).toEqual(['false', 'false', 'false', 'true']);
    await flip(page, 'Old');
    expect((await rows(page)).map(r => r.on)).toEqual(['true', 'false', 'false', 'true']);
    await expect(step(page, 'l-1')).toBeVisible();
  });

  test("a branch named like a place, '#2', and two branches of one name each have a row of their own", async ({ page }) => {
    const clash = { title: 'Clash', branches: [{ name: '#2', items: [{ id: 'c-1', name: 'C one' }] }, { name: 'X', items: [{ id: 'c-2', name: 'C two' }] }, { name: 'X', items: [{ id: 'c-3', name: 'C three' }] }] };
    await openPlan(page, clash, { store: null });
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

test.describe('the grip, more', () => {
  test('a double click on the grip does not change the level, and the page never scrolls to the hidden control', async ({ page }) => {
    await openPlan(page, plain, { store: null });
    await page.locator('.roadmap .zoom .grip').dblclick();
    await settle(page);
    expect(await level(page)).toBe('Main steps');
    await expect(page.locator('.roadmap.tucked')).toHaveCount(1);
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight - innerHeight)).toBe(0);
    await page.mouse.move(200, 20);
    await page.mouse.wheel(0, 400);
    expect(await page.evaluate(() => scrollY)).toBe(0);
  });

  test("with the list open, the grip closes it, and 'Branches' takes no focus while the control is hidden", async ({ page }) => {
    await openPlan(page, versions, { store: null });
    await openList(page);
    await page.locator('.roadmap .zoom .grip').click();
    await expect(list(page)).toBeHidden();
    expect(await layers(page).evaluate(e => (e as HTMLElement).inert)).toBe(true);
  });

  test('on a short view the popup scrolls and never runs off the top', async ({ page }) => {
    await page.setViewportSize({ width: 740, height: 300 });
    await openPlan(page, full, { store: null });
    await openKey(page);
    expect((await popup(page).boundingBox())!.y).toBeGreaterThanOrEqual(0);
  });
});

test.describe('on a phone, more', () => {
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

  test("a tap on 'Branches' closes the sheet of a picked step, as the popup does", async ({ page }) => {
    await openPlan(page, versions, { store: null });
    await step(page, 'w-1').tap();
    await expect(side(page)).toBeVisible();
    await layers(page).tap();
    await expect(list(page)).toBeVisible();
    await expect(side(page)).toBeHidden();
  });

  test('held sideways, a finger still opens the list with no focus in the search', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await openPlan(page, versions, { store: null });
    await layers(page).tap();
    await expect(list(page)).toBeVisible();
    await expect(list(page).getByRole('searchbox')).not.toBeFocused();
  });
});
