// This instance: one page that shows one roadmap file, the one `npm run dev`, `roadmapper dev` or `roadmapper build` names.
// the view's own CSS, then the theme's variables: the theme comes last, as it does in the lib
import '../view/view.css';
import '../themes/theme.css';
// the text of the file and its name: a typo in the file then lands in the view's error list, not in the dev server's error screen
import raw, { file, live } from 'virtual:roadmap';
import { useIconSet } from '../icons/icons.js';
import { tabler } from '../icons/tabler.js';
import { mountRoadmap } from '../view/view.js';

useIconSet('tabler', tabler);
const view = mountRoadmap(document.querySelector<HTMLDivElement>('#app')!, {
  // the level, the view and the place of this page are kept under this name
  store: 'roadmapper.app',
  // 'Export' in the popup saves roadmap.zip, with the files of `npx roadmapper export` in it; the code that makes it loads at the first press
  exportFile: async (text, keep) => (await import('./export.js')).exportZip(text, keep),
  onDraw: roadmap => {
    document.title = `${roadmap.title} · roadmap`;
  },
});
view.show(raw, file);

// `roadmapper dev` sends the file each time it is saved (src/cli/cli.ts); redraw in place, no reload
if (live) {
  let last = raw;
  new EventSource(live).onmessage = e => {
    const sent = JSON.parse(e.data as string) as { text: string; file: string };
    if (sent.text === last) return;
    last = sent.text;
    view.show(sent.text, sent.file);
  };
}

// `npm run dev` sends the new file when it is saved; redraw in place, no reload
if (import.meta.hot) {
  import.meta.hot.accept('virtual:roadmap', mod => {
    if (mod) view.show(mod.default as string, mod.file as string);
  });
}
