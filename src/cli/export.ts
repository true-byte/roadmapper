// The HTML export: the files that show one roadmap on a landing page. They sit side by side in one folder of the site.
// roadmap.json is the roadmap a stranger sees, with no private item, or the whole roadmap when the owner asks, and the icons it names. roadmapper.js is the lib, which reads it and draws it.
// roadmap.html is the whole page: the lib and the tag that reads roadmap.json. Another page shows the roadmap with the same two lines.
// So a new roadmap is a new roadmap.json. The page changes only with the title or the about line, and the lib only with Roadmapper.
// It gets the roadmap as text and does not know where the text comes from: the command `export` (src/cli/cli.ts) reads the file and writes the files.
import picked from '../themes/theme.css?raw';
import { ARROW, BRANCHES, GRIP, INFO, LINKS, type IconSet } from '../icons/icons.js';
import { SET_LOADERS } from '../icons/sets.js';
import type { OwnIcons } from '../lib/element.js';
import { checkRoadmap } from '../roadmap/check.js';
import { sayError } from '../roadmap/errors.js';
import { publicRoadmap } from '../roadmap/public.js';
import type { Branch } from '../roadmap/types.js';

/** The names of the files of an export. */
export const FILES = { page: 'roadmap.html', roadmap: 'roadmap.json', lib: 'roadmapper.js' } as const;

/** The folder of the theme that src/themes/theme.css names in its @import: the theme of the export's lib (src/lib/element.ts). */
const folder = /@import\s+['"]\.\/([^/'"]+)\/theme\.css['"]/.exec(picked)?.[1];
/** The text of its theme.css. */
const theme = import.meta.glob<string>('../themes/*/theme.css', { query: '?raw', import: 'default', eager: true })[`../themes/${folder}/theme.css`] ?? '';
/** The name of the icon set that the theme names, as --icon-set. */
const setName = themeValue(theme, '--icon-set');
/** That set, loaded with this module: `npm run export` runs the source through Vite's runnerImport (scripts/roadmapper.mjs),
 * which shuts its module loader once the import is done, so a set loaded later would not come. */
const set: IconSet | undefined = setName && Object.hasOwn(SET_LOADERS, setName) ? await SET_LOADERS[setName]() : undefined;

/** The page and the roadmap file of an export, from the text of a roadmap file: the roadmap a stranger sees, or with `private` the whole roadmap, as written,
 * where each private item shows its 'Private' tag. A broken roadmap throws its first error, and one where everything is private throws too, unless it is kept. */
export async function exportFiles(text: string, keep: { private?: boolean } = {}): Promise<{ page: string; roadmap: string }> {
  const { roadmap: whole, errors } = checkRoadmap(text);
  if (!whole) throw new Error(sayError(errors[0]));
  const roadmap = keep.private ? whole : publicRoadmap(whole);

  // the icons of the set the theme names, only those the roadmap names and those the view draws itself, with the license of the set;
  // those of the 'Links' part of the side bar only where a step has a link
  const named = new Set<string>([ARROW, INFO, BRANCHES, GRIP].flatMap(o => Object.values(o)));
  const walk = (b: Branch): void => {
    for (const item of b.items) {
      if ('split' in item) item.split.forEach(walk);
      else {
        if (item.icon) named.add(item.icon);
        for (const l of item.links ?? []) [l.icon, ...Object.values(LINKS)].forEach(name => name && named.add(name));
      }
    }
  };
  roadmap.branches.forEach(walk);
  const icons: Record<string, string> = {};
  for (const name of [...named].sort()) {
    const art = set?.art(name);
    if (art) icons[name] = art;
  }
  const own: OwnIcons | undefined = set && setName && Object.keys(icons).length ? { set: setName, size: set.size, license: set.license, icons } : undefined;

  const fail = `The roadmap could not load: ${FILES.lib} did not run.`;
  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>${esc(roadmap.title)} · roadmap</title>
${roadmap.about ? `<meta name="description" content="${esc(roadmap.about)}">\n` : ''}<noscript><style>#roadmapper-wait{display:none}</style></noscript>
<!-- Made with Roadmapper. The code is in ${FILES.lib} and the roadmap in ${FILES.roadmap}, which sit next to this page. -->
<script src="${FILES.lib}" defer onerror="document.getElementById('roadmapper-wait').textContent=${esc(JSON.stringify(fail))}" onload="if(!customElements.get('roadmapper-view'))this.onerror()"></script>
</head>
<body>
<roadmapper-view page src="${FILES.roadmap}">
<p id="roadmapper-wait" style="margin:24px">Loading the roadmap…</p>
<noscript><p style="margin:24px">This roadmap needs JavaScript.</p></noscript>
</roadmapper-view>
</body>
</html>
`;
  return { page, roadmap: `${JSON.stringify(own ? { ...roadmap, icons: own } : roadmap)}\n` };
}

/** A variable a theme sets, from the text of its theme.css: its first value, without quotes. */
function themeValue(css: string, name: string): string | undefined {
  // no comment of the theme counts; a text in quotes may hold a ";", as the address of the fonts does
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const v = new RegExp(`${name}\\s*:\\s*("[^"]*"|'[^']*'|[^;}]+)[;}]`).exec(bare)?.[1].trim();
  return v?.replace(/^(["'])(.*)\1$/, '$2') || undefined;
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
