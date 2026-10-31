// The side bar in edit mode (src/view/edit-side.ts): each field sets its key of a step, a branch or a group, and a field the file check refuses turns red.
import { caption, expect, nameOf, openPlan, saveEdit, settle, side, startEdit, step, test, zoomTo } from '../support/helpers';
import { bakery, edit, nodeOf } from '../support/plans';

test('each field of a step sets its key', async ({ page }) => {
  await openPlan(page, bakery, { store: null, saving: true });
  await zoomTo(page, 'Every step');
  await startEdit(page);
  await step(page, 'open').click();
  const bar = side(page), part = (name: string) => bar.locator('section.part', { has: page.getByRole('heading', { name, exact: true }) });
  await bar.getByRole('radio', { name: 'Done' }).click();
  await bar.getByRole('button', { name: 'Milestone' }).click();
  await bar.getByRole('button', { name: 'Private' }).click();
  await bar.locator('[data-f="why"]').fill('The bakery opens to the public.');
  await bar.locator('[data-f="doneWhen"]').fill('The first loaf is sold.');
  await bar.locator('[data-f="start"]').fill('2027-06-01');
  await bar.locator('[data-f="end"]').fill('2027-06-11');
  await bar.locator('[data-f="deadline"]').fill('2027-06-12');
  // 'Waits for': 'sign' out, 'lease' in, by the search
  await part('Waits for').locator('.edit-row', { hasText: 'Make the sign' }).getByRole('button', { name: 'Remove' }).click();
  await part('Waits for').getByRole('button', { name: 'Add' }).click();
  await part('Waits for').getByRole('searchbox').fill('lease');
  await part('Waits for').locator('.found .row', { hasText: 'Sign the lease' }).click();
  // a link joins the plan once it has a name and an address
  await part('Links').getByRole('button', { name: 'Add' }).click();
  await part('Links').locator('[data-f="link-name-0"]').fill('Menu');
  await part('Links').locator('[data-f="link-url-0"]').fill('https://example.com/menu');
  // the icon, from the grid
  await bar.locator('.name').getByRole('button', { name: 'Icon' }).click();
  await bar.locator('.icon-grid:not([hidden])').getByRole('searchbox').fill('pencil');
  await bar.locator('.icon-grid:not([hidden])').getByRole('button', { name: 'pencil', exact: true }).click();
  expect(nodeOf(await saveEdit(page), 'open')).toEqual({
    id: 'open', name: 'Opening day', state: 'done', milestone: true, private: true, icon: 'pencil',
    why: 'The bakery opens to the public.', doneWhen: 'The first loaf is sold.', start: '2027-06-01', end: '2027-06-11', deadline: '2027-06-12',
    waitsFor: ['lease'], links: [{ name: 'Menu', url: 'https://example.com/menu' }],
  });
});

test('a day typed key by key sets the whole day; a part of one turns red', async ({ page }) => {
  await openPlan(page, bakery, { store: null, saving: true });
  await zoomTo(page, 'Every step');
  await startEdit(page);
  await step(page, 'open').click();
  const start = side(page).locator('[data-f="start"]'), end = side(page).locator('[data-f="end"]');
  await start.focus();
  await page.keyboard.type('06012027');
  await start.blur();
  await end.focus();
  await page.keyboard.type('0611');
  await end.blur();
  await expect(end).toHaveClass(/\bbad\b/);
  const open = nodeOf(await saveEdit(page), 'open');
  expect(open.start).toBe('2027-06-01');
  expect(open.end).toBeUndefined();
});

test('a shown branch with every step done stays shown through a new name', async ({ page }) => {
  const plan = edit(bakery, p => p.branches.unshift({ name: 'Lease', items: [{ id: 'keys', name: 'Get the keys', state: 'done' }] }));
  await openPlan(page, plan, { store: null, saving: true });
  await zoomTo(page, 'Every step');
  await page.locator('.zoom').getByRole('button', { name: 'Branches', exact: true }).click();
  await page.getByRole('dialog', { name: 'Branches' }).locator('[data-tag="Lease"]').click();
  await page.keyboard.press('Escape');
  await startEdit(page);
  await caption(page, 'Lease').click();
  const draws = await page.evaluate(() => window.draws.length);
  await side(page).locator('[data-f="name"]').press('End');
  await page.keyboard.type('s');
  await expect.poll(() => page.evaluate(() => window.draws.length)).toBeGreaterThan(draws);
  await settle(page);
  await expect(caption(page, 'Leases')).toHaveCount(1);
  await expect(side(page)).toBeVisible();
});

test('a refused field turns red, and the plan keeps its last drawing', async ({ page }) => {
  await openPlan(page, bakery, { store: null, saving: true });
  await zoomTo(page, 'Every step');
  await startEdit(page);
  await step(page, 'open').click();
  const name = side(page).locator('[data-f="name"]');
  await name.fill('');
  await expect(name).toHaveClass(/\bbad\b/);
  await name.press('Enter');
  await expect(nameOf(page, 'open')).toHaveText('Opening day');
  await name.fill('Grand opening');
  await expect(name).not.toHaveClass(/\bbad\b/);
  await name.press('Enter');
  await expect(nameOf(page, 'open')).toHaveText('Grand opening');
  // an address that is not one
  await side(page).locator('section.part', { hasText: 'Links' }).getByRole('button', { name: 'Add' }).click();
  await side(page).locator('[data-f="link-name-0"]').fill('Menu');
  await side(page).locator('[data-f="link-url-0"]').fill('menu');
  await expect(side(page).locator('[data-f="link-url-0"]')).toHaveClass(/\bbad\b/);
  const open = nodeOf(await saveEdit(page), 'open');
  expect(open.name).toBe('Grand opening');
  expect(open.links).toBeUndefined();
});

test('the fields of a branch and a group set their keys', async ({ page }) => {
  await openPlan(page, bakery, { store: null, saving: true });
  await zoomTo(page, 'Every step');
  await startEdit(page);
  await caption(page, 'Name').click();
  await side(page).locator('[data-f="name"]').fill('Brand');
  await side(page).locator('[data-f="holds"]').fill('The name of the bakery, and its sign.');
  await side(page).getByRole('button', { name: 'Private' }).click();
  await zoomTo(page, 'Main steps');
  await page.locator('svg.plan g.zn[data-pod="b0.1"]').click();
  await side(page).locator('[data-f="name"]').fill('Fit out the shop');
  await side(page).getByRole('button', { name: 'Private' }).click();
  const saved = await saveEdit(page);
  expect(saved.branches[1]).toMatchObject({ name: 'Brand', holds: 'The name of the bakery, and its sign.', private: true });
  expect(saved.branches[0].items[1]).toMatchObject({ name: 'Fit out the shop', private: true });
});
