// The marks of edit mode on the plan (src/view/edit-marks.ts): the add mark and the add choice, the dashed line of a new branch, the '+' of a new top-level branch,
// the trash, the drags of a step, a branch and a group with their drop slots, and the taps of a finger.
import type { Locator, Page } from '@playwright/test';
import { caption, expect, middle, openPlan, play, saveEdit, settle, side, startEdit, step, stopClock, test, zoomTo } from '../support/helpers';
import { bakery, edit, nodeOf, shapeOf } from '../support/plans';

/** Where a line of a branch starts and ends on the screen: the first line of it the page draws, which for a branch of a split is its bend. */
const lineOf = (page: Page, key: string): Promise<{ from: [number, number]; to: [number, number] }> =>
  page.evaluate(k => {
    const p = document.querySelector<SVGPathElement>(`svg.plan path.hit[data-bar="${k}"]`)!, m = p.getScreenCTM()!;
    const at = (l: number): [number, number] => {
      const q = new DOMPoint(p.getPointAtLength(l).x, p.getPointAtLength(l).y).matrixTransform(m);
      return [q.x, q.y];
    };
    return { from: at(0), to: at(p.getTotalLength()) };
  }, key);

/** The drop slot nearest a point, as the page shows it while a drag is on its way. */
async function slotNear(page: Page, x: number, y: number): Promise<[number, number]> {
  const all = await page.locator('.hands .slot').evaluateAll(es => es.map(e => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
  expect(all.length).toBeGreaterThan(0);
  return all.reduce((a, b) => (Math.hypot(b[0] - x, b[1] - y) < Math.hypot(a[0] - x, a[1] - y) ? b : a)) as [number, number];
}

/** Drags what is under `from` with the mouse to the slot nearest `to`, and drops it there. */
async function drag(page: Page, from: Locator | [number, number], to: [number, number]): Promise<void> {
  const [x, y] = Array.isArray(from) ? from : await middle(from);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 12, y + 12, { steps: 2 });
  const [sx, sy] = await slotNear(page, ...to);
  await page.mouse.move(sx, sy, { steps: 4 });
  await expect(page.locator('.hands .slot.on')).toHaveCount(1);
  await page.mouse.up();
  await settle(page);
}

test('the add mark and its choice add a step and a branching', async ({ page }) => {
  await openPlan(page, bakery, { store: null, saving: true });
  await zoomTo(page, 'Every step');
  await startEdit(page);
  // between 'name' and 'sign'
  const [nx, ny] = await middle(step(page, 'name')), [sx] = await middle(step(page, 'sign'));
  await page.mouse.move((nx + sx) / 2, ny + 12);
  await page.locator('.hand.adder').click();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  // the new step is picked, with its name ready to type over: its id follows its name
  await expect(side(page).locator('[data-f="name"]')).toBeFocused();
  await page.keyboard.type('Buy paint');
  await page.keyboard.press('Enter');
  await expect(step(page, 'buy-paint')).toHaveCount(1);
  // after the last step of 'Name'
  const [lx, ly] = await middle(step(page, 'sign'));
  await page.mouse.move(lx + 60, ly + 8);
  await page.locator('.hand.adder').click();
  await page.getByRole('button', { name: 'Branching', exact: true }).click();
  await settle(page);
  expect(shapeOf(await saveEdit(page))[1]).toBe('Name[name buy-paint sign (New branch[new-step] | New branch[new-step-2])]');
});

test('a group of one track takes a step before its first one', async ({ page }) => {
  const plan = edit(bakery, p => { p.branches[1].items = [{ name: 'Name and sign', split: [{ items: p.branches[1].items }] }]; });
  await openPlan(page, plan, { store: null, saving: true });
  await zoomTo(page, 'Every step');
  await startEdit(page);
  const [nx, ny] = await middle(step(page, 'name').locator('.ring'));
  await page.mouse.move(nx - 24, ny);
  await expect(page.locator('.hand.fork:not(.root)')).toBeHidden();
  await page.locator('.hand.adder').click();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await settle(page);
  expect(shapeOf(await saveEdit(page))[1]).toMatch(/^Name\[.*new-step.*name sign/);
});

test('the dashed line adds a track, and the root + a top-level branch', async ({ page }) => {
  await openPlan(page, bakery, { store: null, saving: true });
  await zoomTo(page, 'Every step');
  await startEdit(page);
  // in the bend of 'Fit out', between its two tracks
  const kitchen = await lineOf(page, 'b0.1.0'), front = await lineOf(page, 'b0.1.1');
  await page.mouse.move(kitchen.from[0] + 24, (kitchen.to[1] + front.to[1]) / 2);
  await page.locator('.hand.fork:not(.root)').click();
  await settle(page);
  await expect(side(page).locator('[data-f="name"]')).toHaveValue('New step');
  await page.locator('.hand.root').click();
  await settle(page);
  expect(shapeOf(await saveEdit(page))).toEqual([
    'Shop[lease (Kitchen[ovens] | New track[new-step] | Front[counter]) open]',
    'Name[name sign]',
    'New branch[new-step-2]',
  ]);
});

test('the trash deletes a step, and takes it out of every waitsFor', async ({ page }) => {
  await openPlan(page, bakery, { store: null, saving: true });
  await startEdit(page);
  await step(page, 'sign').hover();
  await page.locator('.hand.trash').click();
  await settle(page);
  const saved = await saveEdit(page);
  expect(shapeOf(saved)[1]).toBe('Name[name]');
  expect(nodeOf(saved, 'open').waitsFor).toBeUndefined();
});

test('a step drags to another branch; a drop off every slot does nothing', async ({ page }) => {
  await openPlan(page, bakery, { store: null, saving: true });
  await zoomTo(page, 'Every step');
  await startEdit(page);
  const [lx, ly] = await middle(step(page, 'lease'));
  await drag(page, step(page, 'name'), [lx + 40, ly]);
  await expect(side(page).locator('[data-f="name"]')).toHaveValue('Pick a name');
  // let go far from every slot
  const [ox, oy] = await middle(step(page, 'open'));
  await page.mouse.move(ox, oy);
  await page.mouse.down();
  await page.mouse.move(ox + 12, oy + 200, { steps: 4 });
  await expect(page.locator('.hands .slot.on')).toHaveCount(0);
  await page.mouse.up();
  await settle(page);
  expect(shapeOf(await saveEdit(page))).toEqual(['Shop[lease name (Kitchen[ovens] | Front[counter]) open]', 'Name[sign]']);
});

test('a track and a top-level branch drag among their sisters', async ({ page }) => {
  await openPlan(page, bakery, { store: null, saving: true });
  await zoomTo(page, 'Every step');
  await startEdit(page);
  const kitchen = await lineOf(page, 'b0.1.0');
  await drag(page, caption(page, 'Front'), [kitchen.to[0], kitchen.to[1] - 40]);
  const [, sy] = await middle(caption(page, 'Shop'));
  await drag(page, caption(page, 'Name'), [kitchen.from[0], sy - 60]);
  expect(shapeOf(await saveEdit(page))).toEqual(['Name[name sign]', 'Shop[lease (Front[counter] | Kitchen[ovens]) open]']);
});

test('a group drags by its step far out, and by its frame, to any branch', async ({ page }) => {
  await openPlan(page, bakery, { store: null, saving: true });
  await startEdit(page);
  const [ox, oy] = await middle(step(page, 'open'));
  await drag(page, page.locator('svg.plan g.zn[data-pod="b0.1"]'), [ox + 40, oy]);
  await zoomTo(page, 'Tracks');
  const frame = (): Promise<{ x: number; y: number; width: number; height: number }> => page.locator('svg.plan rect.group').boundingBox().then(b => b!);
  const [lx, ly] = await middle(step(page, 'lease'));
  let f = await frame();
  await drag(page, [f.x + f.width / 2, f.y + f.height - 4], [lx - 40, ly]);
  // into the other top-level branch, after its last step
  const [sx, sy] = await middle(step(page, 'sign'));
  f = await frame();
  await drag(page, [f.x + f.width / 2, f.y + f.height - 4], [sx + 40, sy]);
  expect(shapeOf(await saveEdit(page))).toEqual(['Shop[lease open]', 'Name[name sign (Kitchen[ovens] | Front[counter])]']);
});

test('a held group lights the slot of the line it is on, far along it; over its own place, none', async ({ page }) => {
  await openPlan(page, bakery, { store: null, saving: true });
  await startEdit(page);
  const [px, py] = await middle(page.locator('svg.plan g.zn[data-pod="b0.1"]'));
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px + 12, py + 12, { steps: 2 });
  await page.mouse.move(px, py, { steps: 2 });
  await expect(page.locator('.hands .slot.on')).toHaveCount(0);
  // on the line of 'Name', well past the slot after its last step
  const [sx, sy] = await middle(step(page, 'sign')), [ex] = await slotNear(page, sx + 40, sy);
  await page.mouse.move(ex + 80, sy, { steps: 4 });
  await expect(page.locator('.hands .slot.on')).toHaveCount(1);
  await page.mouse.up();
  await settle(page);
  expect(shapeOf(await saveEdit(page))).toEqual(['Shop[lease open]', 'Name[name sign (Kitchen[ovens] | Front[counter])]']);
});

test.describe('a finger', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test('taps show the add mark and add a step with its choice', async ({ page }) => {
    await openPlan(page, bakery, { store: null, saving: true, clock: true });
    await zoomTo(page, 'Every step');
    await page.locator('.zoom').getByRole('button', { name: 'Edit', exact: true }).tap();
    await expect(page.locator('.roadmap')).toHaveClass(/\bediting\b/);
    await stopClock(page);
    // the layout down on a phone: on the line of 'Name', between its two steps
    const [nx, ny] = await middle(step(page, 'name').locator('.ring')), [, sy] = await middle(step(page, 'sign').locator('.ring'));
    await page.touchscreen.tap(nx, (ny + sy) / 2);
    // once the wait of a tap is over, the tap has only shown the add mark: it picks no branch
    await play(page, 1000);
    await expect(page.locator('.hand.adder')).toBeVisible();
    await expect(side(page)).toBeHidden();
    await page.locator('.hand.adder').tap();
    await page.getByRole('button', { name: 'Step', exact: true }).tap();
    await play(page, 1000);
    await expect(step(page, 'new-step')).toHaveCount(1);
    await page.locator('.zoom').getByRole('button', { name: 'Save', exact: true }).tap();
    await expect(page.locator('.roadmap')).not.toHaveClass(/\bediting\b/);
    expect(shapeOf(await page.evaluate(() => window.saves[0]))[1]).toBe('Name[name new-step sign]');
  });
});

test.describe('down', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('top-level branches take the + and their slots under each other', async ({ page }) => {
    await openPlan(page, bakery, { store: null, saving: true });
    await zoomTo(page, 'Every step');
    await startEdit(page);
    // the + of a new top-level branch: under the last one, in line with its first step
    const [sx, sy] = await middle(step(page, 'sign').locator('.ring')), [rx, ry] = await middle(page.locator('.hand.root'));
    expect(ry).toBeGreaterThan(sy);
    expect(Math.abs(rx - sx)).toBeLessThan(2);
    // a drag of 'Name': its slot above 'Shop', in line with its first step
    const [lx, ly] = await middle(step(page, 'lease').locator('.ring')), [, top] = await middle(caption(page, 'Shop'));
    const [cx, cy] = await middle(caption(page, 'Name'));
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 12, cy - 12, { steps: 2 });
    const [ox, oy] = await slotNear(page, lx, top - 40);
    expect(oy).toBeLessThan(top);
    expect(Math.abs(ox - lx)).toBeLessThan(2);
    await page.mouse.move(ox, oy, { steps: 4 });
    await page.mouse.up();
    await settle(page);
    expect(shapeOf(await saveEdit(page))).toEqual(['Name[name sign]', 'Shop[lease (Kitchen[ovens] | Front[counter]) open]']);
    expect(ly).toBeLessThan(sy);
  });
});
