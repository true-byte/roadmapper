// The lib of an HTML export, as one plain script next to the page: it makes <roadmapper-view> known, which the page holds with the attribute `page`.
// It holds no icon set: the roadmap.json the export writes holds the icons it names, so this file stays small and stays the same from one export to the next.
import { defineRoadmapper } from './element.js';

defineRoadmapper();
