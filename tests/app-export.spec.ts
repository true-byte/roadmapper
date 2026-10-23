// 'Export' in the popup of the app: the switch 'Include private items', and the button that saves roadmap.zip, which holds the three files
// that `npx roadmapper export` writes for the same roadmap file. The zip writer itself is checked here with no browser; the tag and the export's page,
// which have no Export, in embed.spec.ts and export.spec.ts.
/// <reference types="node" />
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { crc32 as nodeCrc32 } from 'node:zlib';
import { test as plain, type Download, type Locator, type Page } from '@playwright/test';
import { crc32, zip } from '../src/app/zip';
import { APP_STORE, errorList, expect, keyButton, openApp, openKey, openPlan, play, popup, save as draw, settle, side, step, stopClock, stored, test } from './helpers';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
/** Where each test writes what it makes: a folder of its own, deleted after it. */
const OUT = join(ROOT, 'dist/tests/app-export');
/** The roadmap file of the app page that the tests open (helpers.ts, APP). It has private items. */
const FILE = join(ROOT, 'tests/roadmapper.json');
/** The files of an export, in the order the zip holds them. */
const NAMES = ['roadmap.html', 'roadmap.json', 'roadmapper.js'];

/** A file as the zip holds it: its name, its bytes, and what its headers say of it. */
interface Unzipped {
  name: string;
  data: Buffer;
  crc: number;
  method: number;
  flags: number;
  version: number;
  time: number;
  date: number;
}

/** The files of a zip, read as the format says, from the end record and the central directory. It checks each header against the one before it:
 * the files lie one after another from the start, each local header says what the central directory says, and the central directory ends where the end record starts. */
function unzip(zip: Buffer): Unzipped[] {
  const end = zip.length - 22;
  expect(zip.readUInt32LE(end), 'the end record').toBe(0x06054b50);
  expect(zip.readUInt16LE(end + 20), 'no comment').toBe(0);
  const count = zip.readUInt16LE(end + 10), size = zip.readUInt32LE(end + 12), start = zip.readUInt32LE(end + 16);
  expect(zip.readUInt16LE(end + 8)).toBe(count);
  expect(start + size, 'the central directory ends where the end record starts').toBe(end);
  const files: Unzipped[] = [];
  let at = start, next = 0;
  for (let i = 0; i < count; i++) {
    expect(zip.readUInt32LE(at), 'a header of the central directory').toBe(0x02014b50);
    const nameLength = zip.readUInt16LE(at + 28), more = zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32), local = zip.readUInt32LE(at + 42);
    const name = zip.toString('utf8', at + 46, at + 46 + nameLength), stored = zip.readUInt32LE(at + 20);
    expect(local, 'each file starts where the one before it ends').toBe(next);
    expect(zip.readUInt32LE(local), 'a local header').toBe(0x04034b50);
    expect(zip.subarray(local + 4, local + 30), 'the local header says what the central directory says').toEqual(zip.subarray(at + 6, at + 32));
    expect(zip.toString('utf8', local + 30, local + 30 + nameLength)).toBe(name);
    const data = zip.subarray(local + 30 + nameLength, local + 30 + nameLength + stored);
    expect(zip.readUInt32LE(at + 24), 'stored as it is').toBe(stored);
    files.push({ name, data, crc: zip.readUInt32LE(at + 16), method: zip.readUInt16LE(at + 10), flags: zip.readUInt16LE(at + 8), version: zip.readUInt16LE(at + 6),
      time: zip.readUInt16LE(at + 12), date: zip.readUInt16LE(at + 14) });
    next = local + 30 + nameLength + stored;
    at += 46 + nameLength + more;
  }
  expect(next, 'the central directory starts after the last file').toBe(start);
  expect(at).toBe(end);
  return files;
}

/** Runs a command of src/cli/cli.ts from the source, as `npm run <command> -- <args>` does in this folder, and gives what it said and how it ended. */
function cli(command: string, args: string[]): Promise<{ code: number; said: string }> {
  return new Promise(done => {
    const env = { ...process.env, npm_lifecycle_event: command, INIT_CWD: ROOT };
    execFile(process.execPath, [join(ROOT, 'scripts/roadmapper.mjs'), command, ...args], { cwd: ROOT, env }, (e, out, err) =>
      done({ code: e ? ((e as { code?: number }).code ?? 1) : 0, said: out + err }),
    );
  });
}

/** The folders the tests of this worker made, which each test deletes after it. */
const made: string[] = [];
/** A folder of the test's own, deleted after it. */
function folder(): string {
  mkdirSync(OUT, { recursive: true });
  const dir = mkdtempSync(join(OUT, 'test-'));
  made.push(dir);
  return dir;
}
test.afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** The three files that `npm run export` writes for a roadmap file, with `--private` or not, in the order the zip holds them. */
async function exported(file: string, dir: string, keepPrivate = false): Promise<Buffer[]> {
  const to = join(dir, keepPrivate ? 'export-private' : 'export');
  const { code, said } = await cli('export', [...(keepPrivate ? ['--private'] : []), file, to]);
  expect(code, said).toBe(0);
  return NAMES.map(n => readFileSync(join(to, n)));
}

/** The button 'Export' in the popup, found also while the popup is shut, by its class: its name changes to 'Saved' and to an error. */
const exportButton = (page: Page): Locator => popup(page).locator('button.export');
/** The switch 'Include private items' in the popup, found also while the popup is shut. */
const privateSwitch = (page: Page): Locator => popup(page).getByRole('switch', { name: 'Include private items', includeHidden: true });

/** Presses 'Export' and gives the file the page saves. */
async function save(page: Page): Promise<Download> {
  const [download] = await Promise.all([page.waitForEvent('download'), exportButton(page).click()]);
  return download;
}
/** The files in the zip that the page saved. */
async function filesOf(download: Download): Promise<Unzipped[]> {
  return unzip(readFileSync(await download.path()));
}

plain.describe('the zip', () => {
  plain('holds each file stored as it is, in its order, with its name in UTF-8, its CRC-32, its sizes and its time, then the central directory and the end record', () => {
    const utf8 = new TextEncoder();
    const files = [
      { name: 'roadmap.html', data: utf8.encode('<!doctype html>\n<title>Plant care app · roadmap</title>\n') },
      { name: 'data/plants é.json', data: utf8.encode('{"title":"Plant care app"}\n') },
      { name: 'empty.txt', data: new Uint8Array() },
    ];
    // 20 October 2026, 14:30:59, which zip keeps to the even second below
    const bytes = Buffer.from(zip(files, new Date(2026, 9, 20, 14, 30, 59)));
    expect(bytes.length).toBe(files.reduce((n, f) => n + 30 + 46 + 2 * Buffer.byteLength(f.name) + f.data.length, 22));
    const read = unzip(bytes);
    expect(read.map(f => f.name)).toEqual(files.map(f => f.name));
    read.forEach((f, i) => {
      expect(f.data.equals(Buffer.from(files[i].data)), f.name).toBe(true);
      expect(f.crc, f.name).toBe(nodeCrc32(files[i].data));
      // stored, with names in UTF-8, for zip 1.0
      expect([f.method, f.flags, f.version]).toEqual([0, 0x0800, 10]);
      expect([f.time >> 11, (f.time >> 5) & 63, (f.time & 31) * 2]).toEqual([14, 30, 58]);
      expect([(f.date >> 9) + 1980, (f.date >> 5) & 15, f.date & 31]).toEqual([2026, 10, 20]);
    });
  });

  plain('gives the CRC-32 that zip gives, and a time before 1980 the first day of 1980', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
    const [f] = unzip(Buffer.from(zip([{ name: 'a.txt', data: new Uint8Array([1, 2, 3]) }], new Date(1975, 5, 1, 12))));
    expect([f.time, f.date]).toEqual([0, (1 << 5) | 1]);
  });

  plain('with no file, is the end record alone', () => {
    expect(Buffer.from(zip([])).toString('hex')).toBe(`504b0506${'0'.repeat(36)}`);
  });
});

test.describe("'Export' in the app", () => {
  test("the popup ends with a hairline, the switch 'Include private items', off, and the button 'Export' with its icon, as wide as the popup", async ({ page }) => {
    await openApp(page);
    await openKey(page);
    await expect(popup(page).locator('hr')).toHaveCount(2);
    await expect(privateSwitch(page)).toBeVisible();
    await expect(privateSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(exportButton(page)).toHaveAccessibleName('Export');
    await expect(exportButton(page).locator('svg')).toBeVisible();
    // the switch, then the button, after the second hairline
    expect(await popup(page).evaluate(p => [...p.children].slice(-2).map(e => e.className))).toEqual(['', 'exporting']);
    const inner = await popup(page).evaluate(p => p.clientWidth - parseFloat(getComputedStyle(p).paddingLeft) - parseFloat(getComputedStyle(p).paddingRight));
    expect((await exportButton(page).boundingBox())!.width).toBeCloseTo(inner, 0);
  });

  test('Export saves roadmap.zip, which holds the three files that `npx roadmapper export` writes for the same roadmap file, with no private item; unzipped, its page draws from disk', async ({ page, errors }) => {
    const want = await exported(FILE, folder());
    await openApp(page);
    await openKey(page);
    const download = await save(page);
    expect(download.suggestedFilename()).toBe('roadmap.zip');
    const files = await filesOf(download);
    expect(files.map(f => f.name)).toEqual(NAMES);
    files.forEach((f, i) => expect(f.data.equals(want[i]), f.name).toBe(true));
    // tests/roadmapper.json has private items, which this export leaves out
    expect(files[1].data.equals(Buffer.from(readFileSync(FILE)))).toBe(false);
    expect(files[1].data.toString()).not.toContain('"private"');

    const unzipped = folder();
    for (const f of files) writeFileSync(join(unzipped, f.name), f.data);
    await page.goto(pathToFileURL(join(unzipped, 'roadmap.html')).href);
    await expect(page.locator('svg.plan')).toBeVisible();
    await expect(errorList(page)).toBeHidden();
    // the browser says it does not let the page read roadmap.json, and the page draws the copy it holds
    errors.splice(0, errors.length, ...errors.filter(e => !e.startsWith('Fetch API cannot load file:')));
  });

  test("unzipped, its page is in the device's mode from the first frame, before the lib draws, and 'Light' and 'Dark' draw it in the theme's values of that mode", async ({ page, errors }) => {
    // the page is the one that `npx roadmapper export` writes, byte for byte (above), so this holds for that page too
    const BG = { light: 'rgb(244, 246, 251)', dark: 'rgb(10, 18, 36)' }, LINE = { light: 'rgb(11, 122, 140)', dark: 'rgb(86, 207, 225)' };
    await openApp(page);
    await openKey(page);
    const files = await filesOf(await save(page));
    const unzipped = folder();
    for (const f of files) writeFileSync(join(unzipped, f.name), f.data);
    // at the first frame: the color of the text of the page, which the browser gives by the color-scheme of the page, and whether the plan is drawn yet
    await page.addInitScript(() => {
      requestAnimationFrame(() => {
        (window as unknown as { first: string[] }).first = [getComputedStyle(document.documentElement).color,
          String(!!document.querySelector('roadmapper-view')?.shadowRoot?.querySelector('svg.plan'))];
      });
    });
    const view = page.locator('.roadmap'), mode = (name: string): Locator => popup(page).getByRole('radio', { name, includeHidden: true });
    for (const [device, text] of [['light', 'rgb(0, 0, 0)'], ['dark', 'rgb(255, 255, 255)']] as const) {
      await page.emulateMedia({ colorScheme: device });
      await page.goto(pathToFileURL(join(unzipped, 'roadmap.html')).href);
      await expect(page.locator('svg.plan')).toBeVisible();
      expect(await page.evaluate(() => (window as unknown as { first: string[] }).first), device).toEqual([text, 'false']);
      await expect(view, device).toHaveCSS('background-color', BG[device]);
      await expect(view.locator('svg.plan .lane').first(), device).toHaveCSS('stroke', LINE[device]);
      await settle(page);
      await openKey(page);
      await expect(mode('Device')).toHaveAttribute('aria-checked', 'true');
      for (const [name, s] of [['Light', 'light'], ['Dark', 'dark']] as const) {
        await mode(name).click();
        await expect(view, `${device}: ${name}`).toHaveCSS('background-color', BG[s]);
        await expect(view.locator('svg.plan .lane').first(), `${device}: ${name}`).toHaveCSS('stroke', LINE[s]);
      }
    }
    errors.splice(0, errors.length, ...errors.filter(e => !e.startsWith('Fetch API cannot load file:')));
  });

  test("the zip keeps the links of a shown step, with their icons, and none of a private step; unzipped, its page draws them under 'Links' from disk", async ({ page, errors }) => {
    const dir = folder();
    const { code, said } = await cli('build', [join(ROOT, 'tests/export/plan.json'), join(dir, 'app')]);
    expect(code, said).toBe(0);
    await page.goto(pathToFileURL(join(dir, 'app/index.html')).href);
    await expect(page.locator('svg.plan')).toBeVisible();
    await settle(page);
    await openKey(page);
    const files = await filesOf(await save(page));
    const roadmap = JSON.parse(files[1].data.toString());
    expect(roadmap.branches[0].items.at(-1).links).toEqual([{ name: 'Release notes', url: 'https://example.com/notes', icon: 'book' }, { name: 'Tag', url: 'https://example.com/tag' }]);
    expect(Object.keys(roadmap.icons.icons)).toEqual(expect.arrayContaining(['book', 'link', 'external-link', 'chevron-down']));
    // the link of 'Secret price', a step of a private track, is in neither the roadmap nor the copy the page holds
    for (const f of files.slice(0, 2)) for (const word of ['Price sheet', 'price-sheet', 'receipt']) expect(f.data.toString(), `${f.name}: ${word}`).not.toContain(word);

    const unzipped = folder();
    for (const f of files) writeFileSync(join(unzipped, f.name), f.data);
    await page.goto(pathToFileURL(join(unzipped, 'roadmap.html')).href);
    await expect(page.locator('svg.plan')).toBeVisible();
    await settle(page);
    // the export gives the steps new ids, in reading order: 'Release' is s9
    await step(page, 's9').click();
    await settle(page);
    const rows = side(page).locator('a.row');
    await expect(rows).toHaveText(['Release notes', 'Tag']);
    await expect(rows.first()).toHaveAttribute('href', 'https://example.com/notes');
    for (const row of await rows.all()) await expect(row.locator('svg')).toHaveCount(2);
    await expect(side(page).locator('.fold svg')).toHaveCount(1);
    errors.splice(0, errors.length, ...errors.filter(e => !e.startsWith('Fetch API cannot load file:')));
  });

  test("with 'Include private items' on, the zip holds the whole roadmap, as `npx roadmapper export --private` gives it, and the switch stays on after a reload", async ({ page }) => {
    const dir = folder();
    const want = await exported(FILE, dir, true);
    expect(want[1].equals((await exported(FILE, dir))[1]), 'the whole roadmap is not the roadmap a stranger sees').toBe(false);
    await openApp(page);
    await openKey(page);
    await privateSwitch(page).click();
    await expect(privateSwitch(page)).toHaveAttribute('aria-checked', 'true');
    expect((await stored(page, APP_STORE))?.private).toBe(true);
    const files = await filesOf(await save(page));
    expect(files.map(f => f.name)).toEqual(NAMES);
    files.forEach((f, i) => expect(f.data.equals(want[i]), f.name).toBe(true));

    await page.reload();
    await settle(page);
    await expect(privateSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await openKey(page);
    await privateSwitch(page).click();
    await expect(privateSwitch(page)).toHaveAttribute('aria-checked', 'false');
    expect((await stored(page, APP_STORE))?.private).toBe(false);
  });

  test("a press makes the button a check and 'Saved' in gold for 2 s, then 'Export' again", async ({ page }) => {
    await openApp(page, { clock: true });
    await stopClock(page);
    await openKey(page);
    await save(page);
    await expect(exportButton(page)).toHaveText('Saved');
    await expect(exportButton(page)).toHaveClass(/\bsaved\b/);
    await expect(exportButton(page).locator('svg')).toBeVisible();
    // gold, the --name of the theme, as the knob and the switches that are on
    await expect(exportButton(page)).toHaveCSS('color', 'rgb(232, 184, 74)');
    await expect(exportButton(page)).toHaveCSS('border-color', 'rgb(232, 184, 74)');
    await play(page, 1990);
    await expect(exportButton(page)).toHaveText('Saved');
    await play(page, 10);
    await expect(exportButton(page)).toHaveText('Export');
    await expect(exportButton(page)).not.toHaveClass(/\bsaved\b/);
  });

  test("'Saved' goes when the popup closes, and a popup closed while the export is made opens again on 'Export'", async ({ page }) => {
    // the clock stands, so 'Saved' never ends by its time
    await openApp(page, { clock: true });
    await stopClock(page);
    await openKey(page);
    await save(page);
    await expect(exportButton(page)).toHaveText('Saved');
    await page.keyboard.press('Escape');
    await expect(popup(page)).toBeHidden();
    await keyButton(page).click();
    await expect(exportButton(page)).toHaveText('Export');

    // Escape in the same task as the press: the popup is closed before the export is made
    const [download] = await Promise.all([page.waitForEvent('download'), exportButton(page).evaluate((b: HTMLElement) => {
      b.click();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    })]);
    expect(download.suggestedFilename()).toBe('roadmap.zip');
    await expect(popup(page)).toBeHidden();
    await keyButton(page).click();
    await expect(exportButton(page)).toHaveText('Export');
    await expect(exportButton(page)).not.toHaveClass(/\bsaved\b/);
  });
});

test.describe("'Export' on a roadmap where everything is private", () => {
  /** The app page on a roadmap whose only branch is private, as `npm run build` writes it. */
  async function secretApp(page: Page): Promise<void> {
    const dir = folder(), file = join(dir, 'roadmap.json');
    writeFileSync(file, JSON.stringify({ title: 'Plant care app', branches: [{ name: 'Plant data deal', private: true, items: [
      { id: 'pick-a-supplier', name: 'Pick a supplier' }, { id: 'sign-the-deal', name: 'Sign the deal' },
    ] }] }));
    const { code, said } = await cli('build', [file, join(dir, 'app')]);
    expect(code, said).toBe(0);
    await page.clock.install();
    await page.goto(new URL(`file://${join(dir, 'app/index.html')}`).href);
    await expect(page.locator('svg.plan')).toBeVisible();
    await settle(page);
  }

  test("the button shows the mark of a blocked step and 'Nothing public' in red, as the error list does, and saves nothing; the switch on, it saves the whole roadmap", async ({ page }) => {
    await secretApp(page);
    const downloads: Download[] = [];
    page.on('download', d => downloads.push(d));
    await openKey(page);
    await exportButton(page).click();
    await expect(exportButton(page)).toHaveText('Nothing public');
    await expect(exportButton(page)).toHaveClass(/\bfailed\b/);
    await expect(exportButton(page).locator('svg.mark g.node.blocked')).toBeVisible();
    // red, the --stop of the theme, as the mark of a blocked step
    await expect(exportButton(page)).toHaveCSS('color', 'rgb(255, 122, 122)');
    await expect(exportButton(page)).toHaveCSS('border-color', 'rgb(255, 122, 122)');

    // the error stays until the switch flips
    await page.clock.fastForward(5000);
    await expect(exportButton(page)).toHaveText('Nothing public');
    expect(downloads).toEqual([]);
    await privateSwitch(page).click();
    await expect(exportButton(page)).toHaveText('Export');
    await expect(exportButton(page)).not.toHaveClass(/\bfailed\b/);
    const files = await filesOf(await save(page));
    expect(JSON.parse(files[1].data.toString()).branches[0].name).toBe('Plant data deal');
  });

  test('the error goes when the popup closes, and comes back with the next press', async ({ page }) => {
    await secretApp(page);
    await openKey(page);
    await exportButton(page).click();
    await expect(exportButton(page)).toHaveText('Nothing public');
    await page.keyboard.press('Escape');
    await expect(popup(page)).toBeHidden();
    await keyButton(page).click();
    await expect(exportButton(page)).toHaveText('Export');
    await exportButton(page).click();
    await expect(exportButton(page)).toHaveText('Nothing public');
  });

  test('the error goes when a save of the roadmap file makes a branch public, as the live view draws it', async ({ page }) => {
    const plan = (secret: boolean) => ({ title: 'Plant care app', branches: [{ name: 'Plant data deal', ...(secret ? { private: true } : {}), items: [
      { id: 'pick-a-supplier', name: 'Pick a supplier' }, { id: 'sign-the-deal', name: 'Sign the deal' },
    ] }] });
    await openPlan(page, plan(true), { exporting: true });
    await openKey(page);
    await exportButton(page).click();
    await expect(exportButton(page)).toHaveText('Nothing public');
    await draw(page, plan(false));
    await expect(popup(page)).toBeVisible();
    await expect(exportButton(page)).not.toHaveClass(/\bfailed\b/);
    await expect(exportButton(page)).not.toContainText('Nothing public');
  });
});
