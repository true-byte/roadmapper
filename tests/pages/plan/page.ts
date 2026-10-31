// The plan page: the app's view on the plan a test gives in the address.
// ?plan=<the text of a roadmap file>, ?file=<the name of that file>, and ?store=<name> to keep the level, the view and the place under that name; with no store, nothing is kept.
// ?export gives the popup 'Export', as the app does, with a stand-in for roadmap.zip: the text of the file, or the error of a roadmap the export cannot take.
// ?save gives 'Edit', as the app on a dev server does, with a stand-in for the server: window.saves lists each plan that 'Save' sends. ?save=fail refuses each,
// and ?save=hold keeps each on its way until window.release().
// window.view.show(text, file) draws a new text, as a save of the file does. window.draws lists the title of each good draw.
import '../../../src/view/view.css';
import '../../../src/themes/theme.css';
import { useIconSet } from '../../../src/icons/icons';
import { tabler } from '../../../src/icons/tabler';
import { checkRoadmap } from '../../../src/roadmap/check';
import { RoadmapError } from '../../../src/roadmap/errors';
import { publicRoadmap } from '../../../src/roadmap/public';
import type { Roadmap } from '../../../src/roadmap/types';
import { mountRoadmap, type RoadmapView } from '../../../src/view/view';

useIconSet('tabler', tabler);

declare global {
  interface Window {
    view: RoadmapView;
    draws: string[];
    saves: Roadmap[];
    release: () => void;
  }
}

const asked = new URLSearchParams(location.search);
const draws: string[] = [], saves: Roadmap[] = [];
const view = mountRoadmap(document.querySelector<HTMLDivElement>('#app')!, {
  store: asked.get('store') ?? undefined,
  exportFile: asked.has('export')
    ? async (text, keep) => {
      if (!keep.private) publicRoadmap(checkRoadmap(text).roadmap!);
      return new File([text], 'roadmap.zip');
    }
    : undefined,
  save: asked.has('save')
    ? async roadmap => {
      saves.push(roadmap);
      if (asked.get('save') === 'fail') throw new RoadmapError('Invalid value', 'The server refused the plan.');
      if (asked.get('save') === 'hold') await new Promise<void>(done => (window.release = done));
    }
    : undefined,
  onDraw: roadmap => {
    draws.push(roadmap.title);
  },
});
Object.assign(window, { view, draws, saves });
view.show(asked.get('plan') ?? '', asked.get('file') ?? undefined);
