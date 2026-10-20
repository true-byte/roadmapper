// The lib for a React app: <Roadmap roadmap={...} /> shows a roadmap in a box on the app's page. It is <roadmapper-view> inside, so the view is the same everywhere.
// It draws in the browser only: on a server it renders the empty tag, and the browser fills it.
import { createElement, useEffect, useRef, type CSSProperties, type ReactElement } from 'react';
import { defineRoadmapper, type RoadmapInput, type RoadmapperView } from './element.js';
import { SET_LOADERS } from '../icons/sets.js';
import type { Roadmap as RoadmapFile } from '../roadmap/types.js';

export type { RoadmapFile, RoadmapInput };

export interface RoadmapProps {
  /** The roadmap: the object of a roadmap file, as imported or parsed, or its text. A new one redraws the box in place; the same one again leaves it as it is. */
  roadmap?: RoadmapInput;
  /** Or the address of a roadmap file, which the box reads itself. */
  src?: string;
  /** For the size of the box: 560 px high and as wide as its place, unless the app says otherwise. */
  className?: string;
  style?: CSSProperties;
}

/** A roadmap in a box on the page. */
export function Roadmap({ roadmap, src, className, style }: RoadmapProps): ReactElement {
  const box = useRef<RoadmapperView>(null);
  useEffect(() => defineRoadmapper(SET_LOADERS), []);
  useEffect(() => {
    if (box.current && roadmap !== undefined) box.current.roadmap = roadmap;
  }, [roadmap]);
  // `class`, not `className`: React 18 writes className on a tag of its own as an attribute named "classname"
  return createElement('roadmapper-view', { ref: box, src, class: className, style });
}
