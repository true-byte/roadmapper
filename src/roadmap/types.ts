// The roadmap file: its types, and the states a step can be in.

/** Where a node stands, in the order the key lists them. `tbd` is a far node that is still a guess.
 * No file says `blocked`: a node is blocked while one it waits for is not done. */
export const STATES = ['done', 'in-progress', 'todo', 'blocked', 'canceled', 'tbd'] as const;
export type State = (typeof STATES)[number];
/** The states a file may say. */
export type Written = Exclude<State, 'blocked'>;
export const STATE_NAME: Record<State, string> = {
  done: 'Done',
  'in-progress': 'In progress',
  todo: 'To do',
  blocked: 'Blocked',
  canceled: 'Canceled',
  tbd: 'TBD',
};

export interface RoadNode {
  id: string;
  name: string;
  why?: string;
  doneWhen?: string;
  state?: Written;
  /** What the step is about: the name of a drawing in the icon set of the theme. A step with no icon, or with a name that is not in the set, keeps its mark. */
  icon?: string;
  /** One of the few steps that say where the plan stands. The owner of the plan picks them. */
  milestone?: boolean;
  /** Not for strangers. */
  private?: boolean;
  /** The estimated start and end, and the day it must be done by, as YYYY-MM-DD. */
  start?: string;
  end?: string;
  deadline?: string;
  /** The ids of the steps it waits for, on any branch. */
  waitsFor?: string[];
  /** It waits for private work not done, which the HTML export leaves out. Only the export writes it. */
  waitsForPrivate?: boolean;
}
/** A group or a branching. A group is one item on its branch: tracks side by side that always come back together, or steps in a row.
 * It is a branching when it says so, or when one of its branches ends: then its branches are branches of their own. */
export interface Split {
  split: Branch[];
  /** The name of a group. Zoomed all the way out a group is one step, and this is the name of that step. With no name it takes the names of its tracks. */
  name?: string;
  /** Its branches are branches of their own, not the tracks of one group, though they come back together. */
  branching?: boolean;
  /** Not for strangers, with all that is in it. */
  private?: boolean;
}
export type Item = RoadNode | Split;
export interface Branch {
  name?: string;
  ends?: boolean;
  /** One line of what the branch holds. */
  holds?: string;
  /** Not for strangers, with all that is in it. */
  private?: boolean;
  items: Item[];
}
export interface Roadmap {
  title: string;
  /** One line of what the plan is. */
  about?: string;
  /** The top-level branches. Each stands alone: no line joins one to the next. */
  branches: Branch[];
  /** The drawings of the icons it names. Only the HTML export writes them. */
  icons?: Record<string, unknown>;
}
