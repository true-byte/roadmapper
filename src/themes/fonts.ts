// The fonts of the theme that src/themes/theme.css names, for the builds: the faces that its fonts.css lists, and the plugin that gives them to the view
// as the module 'virtual:theme-fonts', and that ships their files. The files are in the folder fonts/ of the theme, with the license text of each font.
// Each build puts that folder next to its own files, and the view loads each font from there (src/view/fonts.ts), so no font comes from another host.
/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/** One face of a font, as fonts.css gives it: the file is in the folder fonts/ of the theme. */
export interface ThemeFace {
  family: string;
  style: string;
  weight: string;
  display: string;
  unicodeRange: string;
  file: string;
}

/** The name of the folder of the font files: in the theme, and next to the files of each build. */
export const FONTS = 'fonts';

const THEMES = fileURLToPath(new URL('.', import.meta.url));

/** The folder of the theme that src/themes/theme.css names in its @import. */
export function themeFolder(): string {
  const picked = readFileSync(join(THEMES, 'theme.css'), 'utf8');
  const name = /@import\s+['"]\.\/([^/'"]+)\/theme\.css['"]/.exec(picked)?.[1];
  if (!name) throw new Error('src/themes/theme.css names no theme in its @import');
  return join(THEMES, name);
}

/** The folder of the font files of that theme. */
export const fontsFolder = (): string => join(themeFolder(), FONTS);

/** The faces of a fonts.css. Each takes its file from the folder fonts/ next to it, as a woff2 file. */
export function readFaces(css: string): ThemeFace[] {
  return [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) => {
    const said = new Map([...body.matchAll(/([\w-]+)\s*:\s*([^;]+);?/g)].map(([, key, value]) => [key.toLowerCase(), value.trim()]));
    const family = said.get('font-family')?.replace(/^["']|["']$/g, '');
    const file = /^url\(\s*["']?fonts\/([\w.-]+\.woff2)["']?\s*\)\s*format\(\s*["']woff2["']\s*\)$/.exec(said.get('src') ?? '')?.[1];
    if (!family || !file) throw new Error(`fonts.css: each @font-face has a font-family and a src of one woff2 file in fonts/, as url("fonts/name.woff2") format("woff2"), not ${body.trim()}`);
    return { family, style: said.get('font-style') ?? 'normal', weight: said.get('font-weight') ?? '400', display: said.get('font-display') ?? 'swap', unicodeRange: said.get('unicode-range') ?? 'U+0-10FFFF', file };
  });
}

/** The faces of the theme, from its fonts.css. */
export const themeFaces = (): ThemeFace[] => readFaces(readFileSync(join(themeFolder(), 'fonts.css'), 'utf8'));

/** The files of the folder fonts/ of the theme: the fonts and their license texts. */
export const fontFiles = (): string[] => readdirSync(fontsFolder(), { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name).sort();

/** Where the view finds the folder fonts/:
 * - `page`: next to the page, as for the app page, which is one HTML file. The dev server serves the folder of the theme there.
 * - `module`: next to the lib's module, by `new URL('./fonts/…', import.meta.url)` for each file, which the bundler of an app follows and copies into the app.
 * - `script`: next to the plain script, by the address it was loaded from.
 * - `none`: nowhere. The view draws in the fallback fonts, as the test pages do.
 * `module` and `script` write the folder into the build. */
export type FontsAt = 'page' | 'module' | 'script' | 'none';

const ID = 'virtual:theme-fonts';
/** The text that stands for the address of a font file in the module build, until the chunk is written. */
const MARK = '__roadmapper_font__:';
const MARKED = new RegExp(`(["'\`])${MARK}([\\w.-]+)\\1`, 'g');

/** The plugin of the fonts for a build: the module 'virtual:theme-fonts', whose faces() gives each face with the address of its file. */
export function themeFonts(at: FontsAt): Plugin {
  const folder = themeFolder();
  const css = join(folder, 'fonts.css');
  const address = (file: string): string => {
    if (at === 'module') return JSON.stringify(MARK + file);
    if (at === 'script') return `new URL(${JSON.stringify(`${FONTS}/${file}`)}, base ?? document.baseURI).href`;
    return `new URL(${JSON.stringify(`${FONTS}/${file}`)}, document.baseURI).href`;
  };
  return {
    name: 'theme-fonts',
    resolveId: source => (source === ID ? `\0${ID}` : undefined),
    load(id) {
      if (id !== `\0${ID}`) return;
      this.addWatchFile(css);
      const faces = at === 'none' ? [] : readFaces(readFileSync(css, 'utf8'));
      const list = faces.map(({ file, ...f }) => `{ ...${JSON.stringify(f)}, url: ${address(file)} }`);
      // a plain script knows its address only while it runs its first lines
      const base = at === 'script' ? "const base = typeof document !== 'undefined' && document.currentScript instanceof HTMLScriptElement && document.currentScript.src || undefined;\n" : '';
      return `${base}export const faces = () => [\n${list.join(',\n')}\n];`;
    },
    // the address of each file goes in after the build, as `new URL('./fonts/…', import.meta.url)`: the build would put the file inside the lib.
    // ?no-inline keeps the Vite of an app from putting a file under 4 kB into its script as a data: address, which a policy of font-src 'self' refuses;
    // another bundler keeps it on the address of the file, which a server of files leaves out
    renderChunk(code) {
      if (at !== 'module' || !code.includes(MARK)) return;
      return { code: code.replace(MARKED, (_, _q, file: string) => `new URL(${JSON.stringify(`./${FONTS}/${file}?no-inline`)}, import.meta.url).href`), map: null };
    },
    generateBundle() {
      if (at !== 'module' && at !== 'script') return;
      for (const file of fontFiles()) this.emitFile({ type: 'asset', fileName: `${FONTS}/${file}`, source: readFileSync(join(folder, FONTS, file)) });
    },
    configureServer(server) {
      if (at !== 'page') return;
      server.middlewares.use(`/${FONTS}`, (req, res, next) => {
        // the name of a file of the folder as it is: the names hold no letter that an address writes otherwise
        const name = (req.url ?? '').split('?')[0].replace(/^\//, '');
        if (!fontFiles().includes(name)) return next();
        res.setHeader('content-type', fontType(name));
        res.end(readFileSync(join(folder, FONTS, name)));
      });
    },
  };
}

/** The type of a file of the folder fonts/, as a server sends it. */
export const fontType = (name: string): string => (name.endsWith('.woff2') ? 'font/woff2' : 'text/plain; charset=utf-8');
