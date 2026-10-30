// What 'Export' in the app saves (src/app/export.ts): roadmap.zip, which holds the three files that `npx roadmapper export` writes for the same roadmap file.
// The part 'Export' of the popup: tests/view/export.spec.ts. The page of the export: tests/lib/export-script.spec.ts.
/// <reference types="node" />
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Download, Locator, Page } from '@playwright/test';
import { expect, openTools, popup, settle, test } from '../support/helpers';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
/** The export of tests/fixtures/export.json, which npm test writes. */
const EXPORTED = join(ROOT, 'dist/tests/export');
/** The files of an export, in the order the zip holds them. */
const NAMES = ['roadmap.html', 'roadmap.json', 'roadmapper.js'];

/** The button 'Export' in the popup, by its class: its name changes to 'Saved'. */
const exportButton = (page: Page): Locator => popup(page).locator('button.export');

/** Runs a command of the package, as `npx roadmapper <args>` does in the folder `dir`. */
function npx(dir: string, args: string[]): Promise<void> {
  return new Promise((done, failed) => {
    execFile(process.execPath, [join(ROOT, 'dist/cli/roadmapper.js'), ...args], { cwd: dir }, (e, out, err) => (e ? failed(new Error(out + err)) : done()));
  });
}
/** The three files of an export in a folder, in the order the zip holds them. */
const filesIn = (dir: string): Buffer[] => NAMES.map(n => readFileSync(join(dir, n)));

/** The names and the bytes of the files in a zip, read from its central directory. The zip writer itself: tests/app/zip.test.ts. */
function unzip(zip: Buffer): { name: string; data: Buffer }[] {
  const end = zip.length - 22;
  expect(zip.readUInt32LE(end), 'the end record').toBe(0x06054b50);
  const files = [];
  for (let i = 0, at = zip.readUInt32LE(end + 16); i < zip.readUInt16LE(end + 10); i++) {
    const nameLength = zip.readUInt16LE(at + 28), size = zip.readUInt32LE(at + 20), local = zip.readUInt32LE(at + 42);
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    files.push({ name: zip.toString('utf8', at + 46, at + 46 + nameLength), data: zip.subarray(start, start + size) });
    at += 46 + nameLength + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
  }
  return files;
}
/** Presses 'Export', and gives the file the page saves. */
async function save(page: Page): Promise<Download> {
  const [download] = await Promise.all([page.waitForEvent('download'), exportButton(page).click()]);
  return download;
}
/** Checks that a download is roadmap.zip with these three files, byte for byte. */
async function holds(download: Download, want: Buffer[]): Promise<void> {
  expect(download.suggestedFilename()).toBe('roadmap.zip');
  const files = unzip(readFileSync(await download.path()));
  expect(files.map(f => f.name)).toEqual(NAMES);
  files.forEach((f, i) => expect(f.data.equals(want[i]), f.name).toBe(true));
}

test("'Export' saves the files of `npx roadmapper export` in roadmap.zip", async ({ page }) => {
  // the app on the roadmap of the export that npm test writes, as `npx roadmapper build` writes it, and the export of that roadmap with --private
  const dir = mkdtempSync(join(tmpdir(), 'roadmapper-app-'));
  try {
    const file = join(ROOT, 'tests/fixtures/export.json');
    await Promise.all([npx(dir, ['build', file, 'app']), npx(dir, ['export', '--private', file, 'whole'])]);
    await page.goto(pathToFileURL(join(dir, 'app/index.html')).href);
    await expect(page.locator('svg.plan')).toBeVisible();
    await settle(page);
    await openTools(page);

    await test.step("the button 'Export' draws its icon, and 'Saved' its check", async () => {
      await expect(exportButton(page)).toHaveAccessibleName('Export');
      await expect(exportButton(page).locator('svg')).toBeVisible();
      const icon = await exportButton(page).locator('svg').innerHTML();
      await save(page);
      await expect(exportButton(page)).toHaveAccessibleName('Saved');
      await expect(exportButton(page).locator('svg')).toBeVisible();
      expect(await exportButton(page).locator('svg').innerHTML(), 'the check').not.toBe(icon);
    });

    await test.step('the zip holds the export a stranger sees', async () => {
      await holds(await save(page), filesIn(EXPORTED));
    });

    await test.step("with 'Include private items', the zip holds the whole roadmap", async () => {
      await popup(page).getByRole('switch', { name: 'Include private items' }).click();
      const whole = filesIn(join(dir, 'whole'));
      expect(whole[1].equals(filesIn(EXPORTED)[1]), 'the whole roadmap is not the one a stranger sees').toBe(false);
      await holds(await save(page), whole);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
