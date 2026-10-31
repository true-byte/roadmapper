// This instance: one page that shows one roadmap file, the one `npm run dev`, `roadmapper dev` or `roadmapper build` names.
// the view's own CSS, then the theme's variables: the theme comes last, as it does in the lib
import '../view/view.css';
import '../themes/theme.css';
// the text of the file, its name and its key: a typo in the file then lands in the view's error list, not in the dev server's error screen
import raw, { file, key, live, save } from 'virtual:roadmap';
import { useIconSet } from '../icons/icons.js';
import { tabler } from '../icons/tabler.js';
import { RoadmapError, sayError, type FileError } from '../roadmap/errors.js';
import type { Roadmap } from '../roadmap/types.js';
import { mountRoadmap } from '../view/view.js';

useIconSet('tabler', tabler);
/** The name the view of this page is kept under: one name for each roadmap file, by the key of the file. */
const store = `roadmapper.app.${key || file}`;
/** The one name that the view of every file was kept under before. The first page that finds it starts from it, where its file has nothing kept yet, and removes it:
 * a user loses nothing, and no other file starts from it. */
const shared = 'roadmapper.app';
try {
  const was = localStorage.getItem(shared);
  if (was !== null) {
    if (localStorage.getItem(store) === null) localStorage.setItem(store, was);
    localStorage.removeItem(shared);
  }
} catch {
  // no storage: nothing is kept
}

/** Where 'Save' sends the plan: the dev server that served this page. A page with no server to write the file, such as a built file opened from disk, has none. */
const saveTo = save;
/** The text of the file as this page last got it. */
let last = raw;

const view = mountRoadmap(document.querySelector<HTMLDivElement>('#app')!, {
  store,
  // 'Export' in the popup saves roadmap.zip, with the files of `npx roadmapper export` in it; the code that makes it loads at the first press
  exportFile: async (text, keep) => (await import('./export.js')).exportZip(text, keep),
  // 'Edit' shows only on a page that a dev server serves: 'Save' sends the plan to it, and it writes the file (src/cli/save.ts)
  save: saveTo ? plan => send(saveTo, plan) : undefined,
  onDraw: roadmap => {
    document.title = `${roadmap.title} · roadmap`;
  },
});
view.show(raw, file);

/** A save of the file, from the dev server: drawn in place, with no reload. In edit mode, the view keeps it for 'Cancel', and 'Save' overwrites the file. */
function got(text: string, name: string): void {
  if (text === last) return;
  last = text;
  view.show(text, name);
}

/** Sends the plan to the dev server, which writes the file. When the server refuses it, this rejects with the first error of the file check, by its name. */
async function send(to: string, plan: Roadmap): Promise<void> {
  const res = await fetch(to, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(plan) });
  if (!res.ok) {
    const { errors = [] } = (await res.json().catch(() => ({}))) as { errors?: FileError[] };
    const lines = errors.map(e => sayError(e).trim()).join('\n');
    throw errors.length ? new RoadmapError(errors[0].error, lines) : new Error(`${to}: ${res.status}`);
  }
  // the file holds the plan as this text now, as src/cli/save.ts writes it: the server's save of it, on its way, draws nothing again
  last = `${JSON.stringify(plan, null, 2)}\n`;
}

// `roadmapper dev` sends the file each time it is saved (src/cli/cli.ts)
if (live) {
  new EventSource(live).onmessage = e => {
    const sent = JSON.parse(e.data as string) as { text: string; file: string };
    got(sent.text, sent.file);
  };
}

// `npm run dev` sends the new file when it is saved
if (import.meta.hot) {
  import.meta.hot.accept('virtual:roadmap', mod => {
    if (mod) got(mod.default as string, mod.file as string);
  });
}
