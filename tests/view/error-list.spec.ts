// The error list: a broken file shows every error in place of the plan, a row for each, as `npm run validate` prints them.
// Once the file is fixed, the plan comes back as it was, at its level and place.
import { sayError, type FileError } from '../../src/roadmap/errors';
import { errorList, errorRows, expect, level, openPlan, save, settle, step, test, zoomTo } from '../support/helpers';
import { flat, full } from '../support/plans';

/** A file with an error of most kinds, on lines of their own but the last three. */
const BROKEN = `{
  "title": "Broken",
  "branches": [
    { "name": "V1", "items": [
      { "id": "a", "name": "Design", "state": "blocked" },
      { "id": "b", "name": "Build", "waitsfor": ["a"] },
      { "branchng": true, "split": [
        { "name": "Code", "items": [ { "id": "c", "name": "Code one", "start": "2026-02-30" } ] }
      ] },
      { "id": "a", "name": "Again" },
      { "id": "d", "waitsFor": ["nope"], "state": "doing" }
    ] }
  ]
}
`;
const BROKEN_ROWS = ([
  { line: 5, path: 'V1 › Design', key: 'state', error: 'Invalid value', value: '"blocked"' },
  { line: 5, path: 'V1 › Design', key: 'id', error: 'Duplicate id', value: '"a"' },
  { line: 6, path: 'V1 › Build', key: 'waitsfor', error: 'Unknown key', value: '' },
  { line: 7, path: 'V1', key: 'branchng', error: 'Unknown key', value: '' },
  { line: 8, path: 'V1 › Code › Code one', key: 'start', error: 'Invalid date', value: '"2026-02-30"' },
  { line: 10, path: 'V1 › Again', key: 'id', error: 'Duplicate id', value: '"a"' },
  { line: 11, path: 'V1 › d', key: 'state', error: 'Invalid value', value: '"doing"' },
  { line: 11, path: 'V1 › d', key: 'name', error: 'Missing key', value: '' },
  { line: 11, path: 'V1 › d', key: 'waitsFor', error: 'Unknown id', value: '"nope"' },
] satisfies FileError[]).map(sayError);

test('a broken file shows its errors in place of the plan', async ({ page }) => {
  await test.step('a file broken from the start draws once it is fixed', async () => {
    await openPlan(page, BROKEN, { store: null });
    expect(await errorRows(page)).toEqual(BROKEN_ROWS);
    await save(page, flat);
    await expect(errorList(page)).toBeHidden();
    await expect(page.locator('.roadmap .head .title')).toHaveText(flat.title);
    await expect(step(page, 'f-1')).toBeVisible();
  });

  await test.step('the list shows the title, the file, the count and each row', async () => {
    await page.evaluate(t => window.view.show(t, 'roadmap.json'), BROKEN);
    await settle(page);
    const list = errorList(page);
    await expect(list).toBeVisible();
    await expect(list.locator('.title')).toHaveText('Broken');
    await expect(list.locator('.file')).toHaveText('roadmap.json');
    await expect(list.locator('.howmany')).toHaveText('9 errors');
    await expect(list.locator('.cols')).toHaveText('LineWhereKeyErrorValue');
    expect(await errorRows(page)).toEqual(BROKEN_ROWS);
    await expect(step(page, 'f-1')).toBeHidden();
    await expect(page.locator('.roadmap .zoom')).toBeHidden();
  });

  await test.step('a text that is not JSON has no title, and one row', async () => {
    await save(page, '{ "title": "T",\n  "branches": [');
    await expect(errorList(page).locator('.title')).toHaveCount(0);
    await expect(errorList(page).locator('.howmany')).toHaveText('1 error');
    expect(await errorRows(page)).toEqual(['2      Invalid JSON  ']);
  });

  await test.step('a wrong address shows as `npm run validate` prints it', async () => {
    await save(page, '{ "title": "T", "branches": [ { "name": "Main", "items": [\n  { "id": "a", "name": "A", "links": [ { "name": "Doc", "url": "www.example.com" } ] }\n] } ] }');
    expect(await errorRows(page)).toEqual(['2  Main › A › Doc  url  Invalid URL  "www.example.com"']);
  });

  await test.step('the keys do nothing, and the fixed file draws as it was', async () => {
    await save(page, full);
    await zoomTo(page, 'Tracks');
    const before = await step(page, 'kickoff').boundingBox();
    await save(page, BROKEN);
    await expect(errorList(page)).toBeVisible();
    await page.keyboard.press('+');
    await save(page, '{ "title": ');
    expect(await errorRows(page)).toEqual(['1      Invalid JSON  ']);
    await save(page, full);
    await expect(errorList(page)).toBeHidden();
    await expect(errorList(page).locator('.row')).toHaveCount(0);
    expect(await level(page)).toBe('Tracks');
    expect(await step(page, 'kickoff').boundingBox()).toEqual(before);
  });
});
