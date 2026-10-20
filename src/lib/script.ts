// The lib as one plain script, for a page with no bundler: <script src="roadmapper.js" defer></script> makes <roadmapper-view> known to the page.
// It holds the whole icon set: a plain script cannot load a part of itself apart.
import { defineRoadmapper } from './element.js';
import { SET_LOADERS } from '../icons/sets.js';

defineRoadmapper(SET_LOADERS);
