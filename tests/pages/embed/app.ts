// The embed page: a made-up React app that shows a roadmap with <Roadmap>, in a box between its own parts and under its own CSS (index.html).
// ?plan=<the text of a roadmap file>, or ?src=<the address of one>; with neither, the page opens with no box.
// window.setRoadmap(plan) gives the box a new roadmap, an object or a text, as a new prop. window.unmount() takes the box off, as an app that stops
// rendering it does, and window.remount() puts it back. Each renders at once: the page has changed when it returns.
import { createElement, type ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Roadmap, type RoadmapFile } from '../../../src/lib/react';

declare global {
  interface Window {
    setRoadmap(plan: RoadmapFile | string): void;
    unmount(): void;
    remount(): void;
  }
}

interface Props {
  roadmap?: RoadmapFile | string;
  src?: string;
  shown: boolean;
}

function App({ roadmap, src, shown }: Props): ReactElement | null {
  return shown ? createElement(Roadmap, { roadmap, src, style: { height: 560 } }) : null;
}

const asked = new URLSearchParams(location.search);
const props: Props = { roadmap: asked.get('plan') ?? undefined, src: asked.get('src') ?? undefined, shown: asked.has('plan') || asked.has('src') };
const root = createRoot(document.querySelector('#app')!);
function render(change: Partial<Props>): void {
  Object.assign(props, change);
  flushSync(() => root.render(createElement(App, { ...props })));
}
Object.assign(window, {
  setRoadmap: (roadmap: RoadmapFile | string) => render({ roadmap }),
  unmount: () => render({ shown: false }),
  remount: () => render({ shown: true }),
});
render({});
