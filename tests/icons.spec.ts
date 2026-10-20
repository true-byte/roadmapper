// 'Icons tests': a step as a coin with the drawing of its icon, the 'Hide node icons' switch in the popup, the drawings of a group far out, the set the theme names, and the license of the set.
// Checks that look at one page each are steps of one test on that page.
import { icons as tabler } from '@iconify-json/tabler';
import type { Locator, Page } from '@playwright/test';
import { expect, group, iconsSwitch, keyButton, openApp, openKey, openPlan, popup, reload, settle, step, test, zoomTo } from './helpers';
import { edit, full, nodeOf, nodesOf, plain } from './plans';

/** The drawing of an icon in Tabler: its own name, or the icon an alias renames. */
const tablerArt = (name: string): string => tabler.icons[name]?.body ?? tabler.icons[tabler.aliases![name].parent].body;

/** The switch in the popup. Its state is read with the popup shut too. */
const theSwitch = iconsSwitch;
const coinOf = (s: Locator): Locator => s.locator('.coin');
const drawingOf = (s: Locator): Locator => s.locator('.ic .art');
const markOf = (s: Locator): Locator => s.locator('.st');

/** Turns the switch with a click, in the popup, and waits for the view to rest. The popup stays open. */
async function flip(page: Page): Promise<void> {
  await openKey(page);
  await theSwitch(page).click();
  await settle(page);
}

/** How a drawing reads back once the browser has drawn it, to hold it against what is on the page. */
const drawn = (page: Page, art: string): Promise<string> =>
  page.evaluate(a => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.innerHTML = a;
    return g.innerHTML;
  }, art);

const box = async (l: Locator): Promise<{ x: number; y: number; w: number; h: number }> => {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
};

/** No step, at the level shown, has a coin or a drawing, and no group far out has its drawing. */
async function allMarks(page: Page): Promise<void> {
  await expect(page.locator('svg.plan g.zn[data-id] .coin:visible')).toHaveCount(0);
  await expect(page.locator('svg.plan g.zn .ic:visible')).toHaveCount(0);
}

// the steps of the plan 'full' that name an icon that Tabler has; '24-hours' is an alias of 'hours-24'
const iconed = nodesOf(full).filter(n => n.icon && n.icon !== 'no-such-icon');

test("at 'Every step', with icons shown: coins, marks and milestones; then the switch and the key I turn every step to its mark and back", async ({ page }) => {
  await openPlan(page, full);
  await zoomTo(page, 'Every step');

  await test.step('a step whose icon the set has is a coin with that drawing on it', async () => {
    expect(iconed.map(n => n.id)).toEqual(['kickoff', 'plan', 'oa-1', 'pa-1', 'launch', 'later-1']);
    for (const n of iconed) {
      await expect(coinOf(step(page, n.id)), n.id).toBeVisible();
      await expect(drawingOf(step(page, n.id)), n.id).toBeVisible();
      expect(await drawingOf(step(page, n.id)).innerHTML(), n.id).toBe(await drawn(page, tablerArt(n.icon!)));
    }
  });

  await test.step('a step with no icon, or with an icon the set does not have, keeps its mark', async () => {
    for (const id of ['review', 'ob-1', 'ia-1']) {
      await expect(markOf(step(page, id)), id).toBeVisible();
      await expect(coinOf(step(page, id)), id).toBeHidden();
      await expect(drawingOf(step(page, id)), id).toBeHidden();
    }
    // its mark is the full size, as big as on a step in the view with marks
    const plainMark = await box(markOf(step(page, 'review')));
    const coinMark = await box(markOf(step(page, 'plan')));
    expect(plainMark.w).toBeGreaterThan(coinMark.w * 1.6);
  });

  await test.step('a milestone with an icon is a bigger coin than a step with an icon', async () => {
    expect(nodeOf(full, 'kickoff').milestone).toBe(true);
    const milestone = await box(coinOf(step(page, 'kickoff'))), plainCoin = await box(coinOf(step(page, 'plan')));
    expect(milestone.w).toBeGreaterThan(plainCoin.w * 1.1);
    expect(nodeOf(full, 'launch').milestone).toBe(true);
    expect((await box(coinOf(step(page, 'launch')))).w).toBeCloseTo(milestone.w, 0);
  });

  await test.step('the mark of the state sits small on the bottom right edge of a coin', async () => {
    const whole = await box(markOf(step(page, 'review')));
    for (const id of ['kickoff', 'plan', 'oa-1']) {
      const coin = await box(coinOf(step(page, id))), mark = await box(markOf(step(page, id)));
      const dx = mark.x - coin.x, dy = mark.y - coin.y, r = coin.w / 2;
      expect(dx, id).toBeGreaterThan(0);
      expect(dy, id).toBeGreaterThan(0);
      expect(Math.hypot(dx, dy) / r, `${id}: how far out the mark is, against the radius of the coin`).toBeGreaterThan(0.8);
      expect(Math.hypot(dx, dy) / r, id).toBeLessThan(1.2);
      expect(mark.w, `${id}: the mark is small`).toBeLessThan(whole.w * 0.6);
    }
  });

  await test.step('a click on the switch shows every step as its mark, and a second click brings the icons back', async () => {
    await flip(page);
    await expect(theSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await allMarks(page);
    await expect(page.locator('svg.plan g.zn[data-id] .st:visible')).toHaveCount(nodesOf(full).length);
    // a step with an icon now has a mark as big as one with none
    const was = await box(markOf(step(page, 'kickoff'))), none = await box(markOf(step(page, 'review')));
    expect(was.w).toBeCloseTo(none.w, 0);

    await flip(page);
    await expect(theSwitch(page)).toHaveAttribute('aria-checked', 'false');
    for (const n of iconed) {
      await expect(coinOf(step(page, n.id)), n.id).toBeVisible();
      await expect(drawingOf(step(page, n.id)), n.id).toBeVisible();
    }
  });

  await test.step('the key I turns the switch, as the click does', async () => {
    await page.keyboard.press('i');
    await settle(page);
    await expect(theSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await allMarks(page);
    await page.keyboard.press('Shift+I');
    await settle(page);
    await expect(theSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(coinOf(step(page, 'kickoff'))).toBeVisible();
  });
});

test("far out, at 'Main steps': the page first opens with the icons shown and the switch at the end of the zoom control, off; the drawings of groups; the switch hides them too; and the choice comes back after a reload", async ({ page }) => {
  await openPlan(page, full);

  await test.step('the page first opens with the icons shown', async () => {
    await expect(theSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(coinOf(step(page, 'kickoff'))).toBeVisible();
  });

  await test.step('the switch Hide node icons is in the popup that the button at the end of the zoom control opens, off', async () => {
    await expect(page.locator('.zoom > :last-child')).toHaveAttribute('aria-label', 'Key');
    const plus = await page.locator('.zoom').getByRole('button', { name: 'Zoom in' }).boundingBox(), at = await keyButton(page).boundingBox();
    expect(at!.x).toBeGreaterThanOrEqual(plus!.x + plus!.width);
    await expect(popup(page)).toBeHidden();
    await openKey(page);
    const sw = theSwitch(page);
    await expect(sw).toBeVisible();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await expect(sw).toHaveText('Hide node icons');
  });

  await test.step('a group of tracks side by side is drawn as lines that part', async () => {
    for (const name of ['Two deep', 'Four steps']) {
      const art = drawingOf(group(page, name));
      await expect(art, name).toBeVisible();
      await expect(art.locator('circle'), name).toHaveCount(0);
      // one line from the left, two lines out on the right: one above the middle, one below it
      const ends = await art.evaluate(a => {
        const pts = [...a.querySelectorAll('path')].flatMap(p => {
          const len = p.getTotalLength();
          return Array.from({ length: 41 }, (_, i) => p.getPointAtLength((len * i) / 40));
        });
        const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
        const left = pts.filter(p => p.x < minX + 1).map(p => p.y), right = pts.filter(p => p.x > maxX - 1).map(p => p.y);
        return { left: Math.max(...left) - Math.min(...left), up: Math.min(...right), down: Math.max(...right), mid: left[0] };
      });
      expect(ends.left, `${name}: one line on the left`).toBeLessThan(1);
      expect(ends.up, name).toBeLessThan(ends.mid - 3);
      expect(ends.down, name).toBeGreaterThan(ends.mid + 3);
    }
  });

  await test.step('a group of steps in a row is drawn as three steps on a line', async () => {
    const dots = await drawingOf(group(page, 'In a row')).locator('circle').evaluateAll(cs =>
      cs.map(c => ({ x: Number(c.getAttribute('cx')), y: Number(c.getAttribute('cy')) })),
    );
    await expect(drawingOf(group(page, 'In a row'))).toBeVisible();
    expect(dots).toHaveLength(3);
    expect(new Set(dots.map(d => d.y)).size, 'on one line').toBe(1);
    expect(dots[0].x).toBeLessThan(dots[1].x);
    expect(dots[1].x).toBeLessThan(dots[2].x);
  });

  await test.step('far out, the switch hides the drawing of a group shown as one step too', async () => {
    await expect(drawingOf(group(page, 'Two deep'))).toBeVisible();
    await flip(page);
    await allMarks(page);
    await expect(markOf(group(page, 'Two deep'))).toBeVisible();
  });

  await test.step('the choice comes back after a reload', async () => {
    await reload(page);
    await expect(theSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await allMarks(page);

    await flip(page);
    await reload(page);
    await expect(theSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(coinOf(step(page, 'kickoff'))).toBeVisible();
  });
});

/** The popup opens with no switch 'Hide node icons' in it: only 'Hide labels' and the pair of layouts. */
async function noSwitch(page: Page): Promise<void> {
  await openKey(page);
  await expect(popup(page).getByRole('switch')).toHaveCount(1);
  await expect(theSwitch(page)).toBeHidden();
  await expect(popup(page).getByRole('switch', { name: 'Hide labels' })).toBeVisible();
  await expect(popup(page).getByRole('radiogroup', { name: 'Layout' })).toBeVisible();
}

test("a plan that names no icon, or only icons the set does not have, has no switch 'Hide node icons', and still has 'Hide labels'", async ({ page }) => {
  await openPlan(page, plain);
  await noSwitch(page);
  await allMarks(page);
  await openPlan(page, edit(plain, p => { nodeOf(p, 'p-1').icon = 'no-such-icon'; }));
  await expect(page.locator('.roadmap .title')).toHaveText('Plain plan');
  await noSwitch(page);
  await allMarks(page);
});

test("with a theme that names no known icon set, every step keeps its mark and there is no switch 'Hide node icons'", async ({ page }) => {
  // the theme's variable, set on the page before the view starts
  await page.addInitScript(() => {
    const set = (): void => document.documentElement.style.setProperty('--icon-set', 'no-such-set');
    if (document.documentElement) set();
    else document.addEventListener('readystatechange', set, { once: true });
  });
  await openPlan(page, full);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.roadmap')!).getPropertyValue('--icon-set').trim())).toBe('no-such-set');
  await noSwitch(page);
  await allMarks(page);
  await zoomTo(page, 'Every step');
  await allMarks(page);
  await expect(page.locator('svg.plan g.zn[data-id] .st:visible')).toHaveCount(nodesOf(full).length);
});

test('the built page carries the MIT notice of Tabler Icons', async ({ page }) => {
  // the page is one file: its script, with the drawings and their license, is in it
  await openApp(page);
  const built = await page.content();
  expect(built).toContain('Paweł Kuna');
  expect(built).toContain('Permission is hereby granted, free of charge');
});
