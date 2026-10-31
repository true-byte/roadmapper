// 'Edit on page' (src/view/edit.ts): 'Edit' where the page saves its file, 'Cancel' and 'Save', undo and redo, a text that comes in edit mode, and the leave-page prompt.
import { editButton, expect, middle, openPlan, saveEdit, settle, side, startEdit, step, test, zoomTo } from '../support/helpers';
import { bakery, edit, shapeOf } from '../support/plans';

/** Deletes a step with the trash under it. */
async function trash(page: import('@playwright/test').Page, id: string): Promise<void> {
  await step(page, id).hover();
  await page.locator('.hand.trash').click();
  await settle(page);
  await expect(step(page, id)).toHaveCount(0);
}

test('Edit shows only where the page saves its file', async ({ page }) => {
  await openPlan(page, bakery, { store: null });
  await expect(page.locator('.zoom .edit-tool')).toHaveCount(0);
  await openPlan(page, bakery, { store: null, saving: true });
  await expect(editButton(page, 'Edit')).toBeVisible();
  await startEdit(page);
  await expect(editButton(page, 'Edit')).toBeHidden();
  await expect(editButton(page, 'Cancel')).toBeVisible();
  await expect(editButton(page, 'Save')).toHaveAttribute('aria-disabled', 'true');
  // the level stays as it was
  await expect(page.locator('.zoom .stop[aria-current="true"]')).toHaveText('Main steps');
});

test('Cancel drops every change; Save sends the plan and leaves edit mode', async ({ page }) => {
  await openPlan(page, bakery, { store: null, saving: true });
  await startEdit(page);
  await trash(page, 'name');
  await expect(editButton(page, 'Save')).toHaveAttribute('aria-disabled', 'false');
  await editButton(page, 'Cancel').click();
  await settle(page);
  await expect(page.locator('.roadmap')).not.toHaveClass(/\bediting\b/);
  await expect(step(page, 'name')).toHaveCount(1);
  expect(await page.evaluate(() => window.saves.length)).toBe(0);

  await startEdit(page);
  await trash(page, 'name');
  expect(shapeOf(await saveEdit(page))).toEqual(['Shop[lease (Kitchen[ovens] | Front[counter]) open]', 'Name[sign]']);
  await expect(step(page, 'name')).toHaveCount(0);
});

test('a refused save stays in edit mode and shows its error in red', async ({ page }) => {
  await openPlan(page, bakery, { store: null, saving: 'fail' });
  await startEdit(page);
  await trash(page, 'name');
  await editButton(page, 'Save').click();
  await expect(page.locator('.zoom .edit-tool.save.failed')).toContainText('Invalid value');
  await expect(page.locator('.roadmap')).toHaveClass(/\bediting\b/);
});

test('Ctrl+Z undoes the last change since Edit, and Ctrl+Shift+Z redoes it', async ({ page }) => {
  await openPlan(page, bakery, { store: null, saving: true });
  await startEdit(page);
  await trash(page, 'name');
  await trash(page, 'sign');
  await page.keyboard.press('Control+z');
  await expect(step(page, 'sign')).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect(step(page, 'name')).toHaveCount(1);
  // back at the plan of 'Edit': nothing to save
  await expect(editButton(page, 'Save')).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Control+Shift+z');
  await expect(step(page, 'name')).toHaveCount(0);
  expect(shapeOf(await saveEdit(page))[1]).toBe('Name[sign]');
});

test('a change made while Save is on its way is a change from the saved plan', async ({ page }) => {
  await openPlan(page, bakery, { store: null, saving: 'hold' });
  await zoomTo(page, 'Every step');
  await startEdit(page);
  await step(page, 'name').click();
  const milestone = side(page).getByRole('button', { name: 'Milestone' });
  await milestone.click();
  await editButton(page, 'Save').click();
  await side(page).getByRole('button', { name: 'Private' }).click();
  await page.evaluate(() => window.release());
  await expect.poll(() => page.evaluate(() => window.saves.length)).toBe(1);
  // still in edit mode: one undo is back at the saved plan, with nothing to save, and a second goes no further
  await expect(editButton(page, 'Save')).toHaveAttribute('aria-disabled', 'false');
  await page.keyboard.press('Control+z');
  await expect(editButton(page, 'Save')).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Control+z');
  await expect(milestone).toHaveAttribute('aria-pressed', 'true');
});

test('typing in a field keeps the picked step clear of the side bar', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  const long = edit(bakery, p => p.branches[0].items.push(...['Paint the walls', 'Stock the shelves', 'Hire the staff', 'Soft opening'].map((name, i) => ({ id: `p${i}`, name }))));
  await openPlan(page, long, { store: null, saving: true });
  await zoomTo(page, 'Every step');
  await startEdit(page);
  await step(page, 'p3').click();
  await settle(page);
  const draws = await page.evaluate(() => window.draws.length);
  await side(page).locator('[data-f="why"]').fill('The doors open.');
  await expect.poll(() => page.evaluate(() => window.draws.length)).toBeGreaterThan(draws);
  await settle(page);
  const s = (await side(page).boundingBox())!, n = (await step(page, 'p3').boundingBox())!;
  expect(n.x + n.width).toBeLessThan(s.x);
});

test('a text that comes in edit mode waits for Cancel', async ({ page }) => {
  await openPlan(page, bakery, { store: null, saving: true });
  await zoomTo(page, 'Every step');
  await startEdit(page);
  const renamed = edit(bakery, r => { r.title = 'Bakery on Main'; });
  await page.evaluate(t => window.view.show(t, 'roadmap.json'), JSON.stringify(renamed));
  await expect(page.locator('.head .title')).toHaveText('Bakery');
  await editButton(page, 'Cancel').click();
  await expect(page.locator('.head .title')).toHaveText('Bakery on Main');
  // the level stays
  await expect(page.locator('.zoom .stop[aria-current="true"]')).toHaveText('Every step');
});

test('leaving the page with changes not saved brings the leave-page prompt', async ({ page }) => {
  await openPlan(page, bakery, { store: null, saving: true });
  await startEdit(page);
  const [x, y] = await middle(step(page, 'name'));
  await page.mouse.move(x, y);
  await page.locator('.hand.trash').click();
  const asked = new Promise<string>(done => page.once('dialog', d => { done(d.type()); void d.dismiss(); }));
  await page.close({ runBeforeUnload: true });
  expect(await asked).toBe('beforeunload');
});
