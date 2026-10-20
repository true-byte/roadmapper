// The lib for a page that is not a React app, through a bundler: importing it makes <roadmapper-view> known to the page.
import { defineRoadmapper } from './element.js';
import { SET_LOADERS } from '../icons/sets.js';

defineRoadmapper(SET_LOADERS);

export { defineRoadmapper, type RoadmapInput, type RoadmapperView } from './element.js';
export type { Roadmap as RoadmapFile } from '../roadmap/types.js';
