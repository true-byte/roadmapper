// The state the file gives each step.
import type { Branch, Roadmap, State } from './types.js';

/** The state the file gives each step, by id, in reading order: a step with no state is still to do. The view tells a changed step by it, from one draw to the next. */
export function nodeStates(roadmap: Roadmap): Map<string, State> {
  const out = new Map<string, State>();
  const walk = (b: Branch): void => {
    for (const it of b.items) {
      if ('split' in it) it.split.forEach(walk);
      else out.set(it.id, it.state ?? 'todo');
    }
  };
  roadmap.branches.forEach(walk);
  return out;
}
