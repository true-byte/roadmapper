// What the builds of the test pages share. Each page is an HTML file with its script in a file next to it, opened from disk, so each is kept light.
import { icons as tabler } from '@iconify-json/tabler';
import type { Plugin } from 'vite';
import { nodesOf, plans } from './plans';

/** The script stays out of the page, as the browser then need not read the script as a part of the page.
 * It is a plain script, not a module, since a module does not load from disk; it runs in strict mode, as a module does. */
export const plainScript: Plugin = {
  name: 'plain-script',
  transformIndexHtml: {
    order: 'post',
    handler: html => html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/, '<script defer src="$1"></script>'),
  },
};

const named = new Set(Object.values(plans).flatMap(p => nodesOf(p).flatMap(n => (n.icon ? [n.icon] : []))));
const aliases = Object.fromEntries(Object.entries(tabler.aliases ?? {}).filter(([name]) => named.has(name)));
const kept = new Set([...named, ...Object.values(aliases).map(a => a.parent)]);
const subset = { ...tabler, icons: Object.fromEntries(Object.entries(tabler.icons).filter(([name]) => kept.has(name))), aliases };
const SUBSET = '\0tabler-subset';
/** The icon set is Tabler with only the icons that the plans in tests/plans.ts name, and the aliases among them: the whole set is 2 MB to read on each open.
 * The drawings are Tabler's own. A test that names another icon puts it in a plan there. His page, the app build, has the whole set. */
export const fewIcons: Plugin = {
  name: 'tabler-subset',
  enforce: 'pre',
  resolveId: id => (id === '@iconify-json/tabler' ? SUBSET : undefined),
  load: id => (id === SUBSET ? `export const icons = ${JSON.stringify(subset)};` : undefined),
};
