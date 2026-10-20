// Hover and click: a hover lights a step, a branch or a pill and shows its tip; a click picks it, lights it in gold and opens the side bar.
// No click zooms, the picked thing never lies under the side bar, and a pick lives through a save while its step is still in the plan.
import type { Locator, Page } from '@playwright/test';
import { caption, expect, group, level, nameOf, openPlan, pill, play, save, settle, side, step, stopClock, test, tip, zoomTo } from './helpers';
import { edit, full, nodeOf, wordy } from './plans';

/** The plan 'full' at 'Tracks', with no motion. */
async function atTracks(page: Page): Promise<void> {
  await openPlan(page, full, { store: null });
  await zoomTo(page, 'Tracks');
}

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

/** Clicks and waits until the plan is at rest, side bar and all. */
async function press(page: Page, where: Locator | { x: number; y: number }): Promise<void> {
  if ('x' in where) await page.mouse.click(where.x, where.y);
  else await where.click();
  await settle(page);
}

/** Empty space on the plan at 'Tracks': between its two top-level branches, wherever the plan is scrolled across. */
const EMPTY = { x: 700, y: 480 };

/** Ends what the last check left: the pointer goes to empty space, and the side bar closes. The next check starts as on a page just opened. */
async function rest(page: Page): Promise<void> {
  await page.mouse.move(EMPTY.x, EMPTY.y);
  await page.keyboard.press('Escape');
  await settle(page);
  await expect(tip(page)).toBeHidden();
  await expect(side(page)).toBeHidden();
}

/** The box of a thing comes to lie clear of the side bar, and on the screen. A smooth scroll may start a few frames after the click, so this waits for it. */
async function clearOfSide(page: Page, thing: Locator): Promise<void> {
  const s = (await side(page).boundingBox())!;
  await expect.poll(async () => {
    const r = await thing.boundingBox();
    return r && r.width > 0 ? r.x + r.width : Infinity;
  }, { message: 'the picked thing ends left of the side bar' }).toBeLessThanOrEqual(s.x);
  const r = (await thing.boundingBox())!;
  expect(r.x, 'the picked thing is on the screen').toBeGreaterThanOrEqual(0);
}

// Checks on one page at 'Tracks' are steps of one test, each from rest().
test('a hover: on a step, as the pointer leaves it, on the line and on the gold name of a branch, and on a pill', async ({ page }) => {
  await atTracks(page);

  await test.step('on a step lights it and shows its name in a tip over it', async () => {
    await step(page, 'review').hover();
    await expect(ringOf(page, 'review')).toHaveCSS('opacity', '0.4');
    await expect(tip(page)).toBeVisible();
    await expect(tip(page)).toContainText('Review');
    await expect(tip(page)).toContainText('Blocked');
    const t = (await tip(page).boundingBox())!, s = (await step(page, 'review').boundingBox())!, n = (await nameOf(page, 'review').boundingBox())!;
    expect(t.y + t.height, 'the tip ends over the step and its name').toBeLessThanOrEqual(Math.min(s.y, n.y) + 0.5);
    expect(t.x).toBeLessThanOrEqual(s.x + s.width / 2);
    expect(t.x + t.width).toBeGreaterThanOrEqual(s.x + s.width / 2);
  });

  await rest(page);
  await test.step('ends when the pointer leaves the step: the tip hides and the light goes', async () => {
    await step(page, 'review').hover();
    await expect(tip(page)).toBeVisible();
    await page.mouse.move(EMPTY.x, EMPTY.y);
    await expect(tip(page)).toBeHidden();
    await expect(ringOf(page, 'review')).toHaveCSS('opacity', '0');
  });

  await rest(page);
  await test.step('on the line of a branch lights the branch and shows its tip', async () => {
    const p = await onLine(page, 'Main');
    await page.mouse.move(p.x, p.y);
    await expect(tip(page)).toBeVisible();
    await expect(tip(page)).toContainText('Main');
    await expect(tip(page)).toContainText('The first top-level branch.');
    // its lines are drawn thicker and its gold name turns to the ink of the page
    await expect(page.locator('svg.plan path.lane').filter({ visible: true }).and(page.locator('.hot')).first()).toHaveCSS('stroke-width', '3.5px');
    await expect(caption(page, 'Main')).not.toHaveCSS('fill', await gold(page));
  });

  await rest(page);
  await test.step('on the gold name of a branch shows the tip of that branch', async () => {
    await caption(page, 'Path A').hover();
    await expect(tip(page)).toBeVisible();
    await expect(tip(page)).toContainText('Path A');
    await expect(tip(page)).toContainText('0 of 1 done');
  });

  await rest(page);
  await test.step('on a pill shows the tip of its track over the pill', async () => {
    await pill(page, 'Quad').hover();
    await expect(tip(page)).toBeVisible();
    await expect(tip(page)).toContainText('Quad');
    await expect(tip(page)).toContainText('1 of 4 done');
    await expect(tip(page)).toContainText('Four steps, one done.');
    const t = (await tip(page).boundingBox())!, s = (await pill(page, 'Quad').boundingBox())!;
    expect(t.y + t.height, 'the tip ends over the pill').toBeLessThanOrEqual(s.y + 0.5);
  });
});

test('a click on a step: it is picked, the side bar shows its data and what blocks it, and Escape, the close button or empty space closes it', async ({ page }) => {
  await atTracks(page);

  await test.step('picks it: gold ring, gold name, and the side bar with what the plan says', async () => {
    await press(page, step(page, 'kickoff'));
    const g = await gold(page);
    await expect(ringOf(page, 'kickoff')).toHaveCSS('stroke', g);
    await expect(ringOf(page, 'kickoff')).toHaveCSS('opacity', '1');
    await expect(nameOf(page, 'kickoff')).toHaveCSS('fill', g);
    const bar = side(page);
    await expect(bar).toBeVisible();
    await expect(bar.locator('h2')).toHaveText('Kickoff');
    await expect(bar.locator('.facts')).toContainText('Done');
    await expect(bar.locator('.facts')).toContainText('Milestone');
    const part = (name: string): Locator => bar.locator('section.part').filter({ has: page.locator('h3', { hasText: name }) });
    await expect(part('Why').locator('p')).toHaveText('Every later step needs a start.');
    await expect(part('Done when').locator('p')).toHaveText('The team has met once.');
    await expect(part('Planned').locator('p')).toHaveText('Jan 5, 2026 to Jan 9, 2026');
    await expect(part('Deadline').locator('p')).toHaveText('Jan 10, 2026');
  });

  // rest() closes the side bar with Escape, so Escape is checked first
  await test.step('the key Escape closes the side bar', async () => {
    await expect(side(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(side(page)).toBeHidden();
  });

  await rest(page);
  await test.step('shows the steps that block it as rows', async () => {
    await press(page, step(page, 'review'));
    const waits = side(page).locator('section.part').filter({ has: page.locator('h3', { hasText: 'Blocked by' }) });
    await expect(waits.locator('.row')).toHaveText(['Quad four', 'Path B one']);
  });

  await rest(page);
  await test.step('a click on empty space closes the side bar and the gold goes', async () => {
    await press(page, step(page, 'kickoff'));
    await expect(side(page)).toBeVisible();
    await press(page, EMPTY);
    await expect(side(page)).toBeHidden();
    await expect(ringOf(page, 'kickoff')).not.toHaveCSS('stroke', await gold(page));
  });

  await rest(page);
  await test.step('the close button closes the side bar', async () => {
    await press(page, step(page, 'kickoff'));
    await press(page, side(page).getByRole('button', { name: 'Close' }));
    await expect(side(page)).toBeHidden();
  });
});

test('a click on a branch: on its line or its name it is picked, with its steps as rows, and a row picks its step', async ({ page }) => {
  await atTracks(page);

  await test.step('on its line opens the side bar with its steps as rows', async () => {
    await press(page, await onLine(page, 'Main'));
    await expect(side(page)).toBeVisible();
    await expect(side(page).locator('h2')).toHaveText('Main');
    const rows = await side(page).locator('button.row').allInnerTexts();
    expect(rows.map(r => r.split('\n')[0].trim())).toEqual(
      ['Kickoff', 'Plan', 'Two deep', 'In a row', 'Four steps', 'Path A', 'Path B', 'Review', 'Spin-off', 'Dead end', 'Launch'].map(n => expect.stringMatching(new RegExp(`^${n}$`, 'i'))),
    );
  });

  await rest(page);
  await test.step('lights its line in gold while it is picked', async () => {
    await press(page, caption(page, 'Path A'));
    await expect(page.locator('svg.plan path.lane.picked').first()).toHaveCSS('stroke', await gold(page));
  });

  await rest(page);
  await test.step('then a click on a row picks that step', async () => {
    await press(page, caption(page, 'Main'));
    await press(page, side(page).getByRole('button', { name: 'Review', exact: true }));
    await expect(side(page).locator('h2')).toHaveText('Review');
    await expect(ringOf(page, 'review')).toHaveCSS('stroke', await gold(page));
  });

  await rest(page);
  await test.step('then a click on a row of a step in a closed track lights the pill of that track', async () => {
    await press(page, caption(page, 'Quad'));
    await expect(side(page).locator('button.row')).toHaveText(['Quad one', 'Quad two', 'Quad three', 'Quad four']);
    await press(page, side(page).getByRole('button', { name: 'Quad two', exact: true }));
    await expect(side(page).locator('h2')).toHaveText('Quad two');
    await expect(step(page, 'q-2')).toBeHidden();
    await expect(pill(page, 'Quad').locator('text')).toHaveCSS('fill', await gold(page));
  });
});

test('a click on a group at Main steps opens its tracks as rows', async ({ page }) => {
  await openPlan(page, full, { store: null });
  expect(await level(page)).toBe('Main steps');
  await press(page, page.locator('svg.plan g.zn[data-pod]').filter({ visible: true }).first());
  await expect(side(page).locator('h2')).toHaveText('Two deep');
  await expect(side(page).locator('button.row')).toHaveText([/^Outer A/, /^Outer B/]);
});

test('no click zooms: the level and the size of the plan stay the same', async ({ page }) => {
  await openPlan(page, full, { store: null });
  for (const name of ['Main steps', 'Tracks', 'Every step']) {
    await zoomTo(page, name);
    const width = await page.locator('svg.plan').getAttribute('width');
    const same = async (what: string): Promise<void> => {
      await settle(page);
      expect(await level(page), `after ${what} at '${name}'`).toBe(name);
      expect(await page.locator('svg.plan').getAttribute('width'), `after ${what} at '${name}'`).toBe(width);
    };
    const groups = page.locator('svg.plan g.zn[data-pod]').filter({ visible: true });
    if (await groups.count()) {
      await groups.first().click();
      await same('a click on a group');
    }
    await step(page, 'plan').click();
    await same('a click on a step');
    await caption(page, 'Path A').click();
    await same('a click on a branch');
    await side(page).locator('button.row').first().click();
    await same('a click on a row');
    await page.mouse.click(EMPTY.x, EMPTY.y);
    await same('a click on empty space');
  }
});

test.describe('the picked thing never ends under the side bar', () => {
  test('a step or a branch on the right of a plan that fits, and a step picked from a row of the side bar', async ({ page }) => {
    await atTracks(page);
    await test.step('a step on the right of a plan that fits', async () => {
      await press(page, step(page, 'spin-1'));
      await clearOfSide(page, step(page, 'spin-1'));
    });

    await rest(page);
    await test.step('a step picked from a row of the side bar', async () => {
      await press(page, caption(page, 'Main'));
      await press(page, side(page).getByRole('button', { name: 'Launch', exact: true }));
      await clearOfSide(page, step(page, 'launch'));
    });

    await rest(page);
    await test.step('a branch on the right of a plan that fits', async () => {
      await press(page, caption(page, 'Dead end'));
      await clearOfSide(page, caption(page, 'Dead end'));
    });
  });

  test('a step still picked after a zoom out and back in', async ({ page }) => {
    await atTracks(page);
    await press(page, step(page, 'spin-1'));
    await zoomTo(page, 'Main steps');
    await clearOfSide(page, step(page, 'spin-1'));
    await zoomTo(page, 'Every step');
    await clearOfSide(page, step(page, 'spin-1'));
    await zoomTo(page, 'Tracks');
    await clearOfSide(page, step(page, 'spin-1'));
  });

  test('a step still picked after a save', async ({ page }) => {
    await atTracks(page);
    await press(page, step(page, 'launch'));
    await save(page, edit(full, c => { nodeOf(c, 'launch').why = 'Ship it.'; }));
    await expect(side(page)).toContainText('Ship it.');
    await clearOfSide(page, step(page, 'launch'));
  });

  test('a step still picked after the window gets smaller', async ({ page }) => {
    await atTracks(page);
    await press(page, step(page, 'review'));
    await page.setViewportSize({ width: 1100, height: 800 });
    await settle(page);
    await clearOfSide(page, step(page, 'review'));
  });

  test('a group lit far out by a step picked from the rows', async ({ page }) => {
    await openPlan(page, full, { store: null });
    await press(page, group(page, 'Four steps'));
    await press(page, side(page).getByRole('button', { name: /^Quad/ }));
    await press(page, side(page).getByRole('button', { name: 'Quad two', exact: true }));
    await expect(side(page).locator('h2')).toHaveText('Quad two');
    await expect(group(page, 'Four steps').locator('.aura')).toHaveCSS('stroke', await gold(page));
    expect(await level(page)).toBe('Main steps');
    await clearOfSide(page, group(page, 'Four steps'));
  });

  test('on a plan that fits, the part under the side bar can be dragged clear of it, and the plan fits again when the side bar closes', async ({ page }) => {
    // the plan 'wordy' fits the window at 'Tracks', and runs under the side bar
    await openPlan(page, wordy, { store: null });
    await zoomTo(page, 'Tracks');
    const stage = page.locator('.stage');
    await expect(stage, 'the level fits').toHaveCSS('overflow', 'hidden');
    await press(page, step(page, 'w-1'));
    const end = step(page, 'w-8'), s = (await side(page).boundingBox())!;
    expect((await end.boundingBox())!.x, 'the last step lies under the side bar').toBeGreaterThan(s.x);
    // it scrolls, so a swipe of a touchpad moves it too
    await expect(stage).not.toHaveCSS('overflow', 'hidden');
    await page.mouse.move(900, 300);
    await page.mouse.down();
    await page.mouse.move(100, 300, { steps: 4 });
    await page.mouse.up();
    await settle(page);
    await clearOfSide(page, end);
    await page.keyboard.press('Escape');
    await settle(page);
    await expect(stage).toHaveCSS('overflow', 'hidden');
    expect(await stage.evaluate(e => e.scrollLeft)).toBe(0);
  });

  test('a step at the right end of a plan that scrolls, with motion', async ({ page }) => {
    // on a stopped clock, the move to 'Every step' plays in the time the clock is moved on by
    await openPlan(page, full, { store: null, motion: true, clock: true });
    await stopClock(page);
    await page.locator('.zoom').getByRole('button', { name: 'Every step', exact: true }).click();
    await play(page, 2000);
    expect(await level(page)).toBe('Every step');
    await page.locator('.stage').evaluate(s => { s.scrollLeft = s.scrollWidth; });
    await settle(page);
    await press(page, step(page, 'spin-1'));
    await clearOfSide(page, step(page, 'spin-1'));
  });
});

test.describe('a pick and a save', () => {
  const plain = (page: Page): Promise<void> => atTracks(page).then(() => press(page, step(page, 'review')));

  test('the pick stays, with the new data in the side bar', async ({ page }) => {
    await plain(page);
    await save(page, edit(full, c => {
      const n = nodeOf(c, 'review');
      n.why = 'A new reason.';
      n.state = 'done';
    }));
    await expect(side(page)).toBeVisible();
    await expect(side(page).locator('h2')).toHaveText('Review');
    await expect(side(page)).toContainText('A new reason.');
    await expect(side(page).locator('.facts')).toContainText('Done');
    await expect(ringOf(page, 'review')).toHaveCSS('stroke', await gold(page));
  });

  test('a picked branch stays that branch when a save puts another branch before it', async ({ page }) => {
    await atTracks(page);
    await press(page, caption(page, 'Later'));
    await expect(side(page).locator('h2')).toHaveText('Later');
    await save(page, edit(full, c => { c.branches.unshift({ name: 'First', items: [{ id: 'new-1', name: 'New one' }] }); }));
    await expect(side(page).locator('h2')).toHaveText('Later');
    await expect(caption(page, 'Later')).toHaveClass(/(^| )picked( |$)/);
    await expect(caption(page, 'Main')).not.toHaveClass(/(^| )picked( |$)/);
  });

  test('a picked branch stays picked when it is renamed', async ({ page }) => {
    await atTracks(page);
    await press(page, caption(page, 'Quad'));
    await save(page, edit(full, c => {
      const four = c.branches[0].items.find(it => 'split' in it && it.name === 'Four steps');
      if (four && 'split' in four) four.split[0].name = 'Quartet';
    }));
    await expect(side(page).locator('h2')).toHaveText('Quartet');
  });

  test('a picked group stays that group when a save puts a step and a group before it', async ({ page }) => {
    await openPlan(page, full, { store: null });
    await press(page, group(page, 'Four steps'));
    await expect(side(page).locator('h2')).toHaveText('Four steps');
    await save(page, edit(full, c => {
      c.branches[0].items.unshift(
        { id: 'new-1', name: 'New one' },
        { name: 'New pair', split: [{ name: 'New A', items: [{ id: 'new-a', name: 'New A one' }] }, { name: 'New B', items: [{ id: 'new-b', name: 'New B one' }] }] },
      );
    }));
    await expect(side(page).locator('h2')).toHaveText('Four steps');
    await expect(group(page, 'Four steps').locator('.aura')).toHaveCSS('stroke', await gold(page));
    await expect(group(page, 'Two deep').locator('.aura')).not.toHaveCSS('stroke', await gold(page));
  });

  test('the side bar closes when the picked step is gone', async ({ page }) => {
    await plain(page);
    await save(page, edit(full, c => {
      const main = c.branches[0];
      main.items = main.items.filter(it => !('id' in it && it.id === 'review'));
      delete nodeOf(c, 'launch').waitsFor;
    }));
    await expect(step(page, 'review')).toHaveCount(0);
    await expect(side(page)).toBeHidden();
    await expect(page.locator('svg.plan .picked')).toHaveCount(0);
  });
});
