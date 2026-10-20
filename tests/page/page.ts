// The test page: the app's view on the plan a test gives in the address.
// ?plan=<the text of a roadmap file>, ?file=<the name of that file>, and ?store=<name> to keep the level, the view and the place under that name; with no store, nothing is kept.
// window.view.show(text, file) draws a new text, as a save of the file does. window.draws lists the title of each good draw.
import '../../src/view/view.css';
import '../../src/themes/theme.css';
import { useIconSet } from '../../src/icons/icons';
import { tabler } from '../../src/icons/tabler';
import { mountRoadmap, type RoadmapView } from '../../src/view/view';

useIconSet('tabler', tabler);

declare global {
  interface Window {
    view: RoadmapView;
    draws: string[];
  }
}

const asked = new URLSearchParams(location.search);
const draws: string[] = [];
const view = mountRoadmap(document.querySelector<HTMLDivElement>('#app')!, {
  store: asked.get('store') ?? undefined,
  onDraw: roadmap => {
    draws.push(roadmap.title);
  },
});
Object.assign(window, { view, draws });
view.show(asked.get('plan') ?? '', asked.get('file') ?? undefined);
