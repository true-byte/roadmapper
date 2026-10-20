// The icon sets a theme can name, each loaded only when it is needed: a set is big. The lib for a page that holds no icons of its own loads them from here.
// The lib of an HTML export does not: the roadmap.json the export writes holds the icons it names, so this file is not in it.
import type { IconSet } from './icons.js';

/** How to load each set, by the name a theme gives it. */
export const SET_LOADERS: Record<string, () => Promise<IconSet>> = {
  tabler: () => import('./tabler.js').then(m => m.tabler),
};
