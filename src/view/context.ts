// The context of one view: what mountRoadmap() makes once, the state of the view, and what each part of the view does. Each view has a context of its own,
// so two views on one page share nothing. A part gets the context, reads and writes the state in it, and calls the other parts through it.
import type { AimPart } from './aim.js';
import type { BlockersPart } from './blockers.js';
import type { BranchesPart } from './branches.js';
import type { Dom, Mode } from './dom.js';
import type { DrawPart, NodeEls, PodEls } from './draw.js';
import type { ErrorListPart } from './error-list.js';
import type { ExportPart } from './export.js';
import type { FactsPart } from './facts.js';
import type { FontsPart } from './fonts.js';
import type { FramePart } from './frame.js';
import type { HoverPart } from './hover.js';
import type { Layout, Layouts } from './layout.js';
import type { MovesPart } from './moves.js';
import type { OpeningPart } from './opening.js';
import type { PaintPart } from './paint.js';
import type { Hold, Past, PlacePart } from './place.js';
import type { Plan, TBranch, TNode, TSplit, Thing } from './plan.js';
import type { ResizePart } from './resize.js';
import type { ScalePart } from './scale.js';
import type { ScrollPart } from './scroll.js';
import type { Ref, SidePart } from './side.js';
import type { StorePart } from './store.js';
import type { TidyPart } from './tidy.js';
import type { ToolbarPart } from './toolbar.js';
import type { ViewOptions } from './view.js';

/** What mountRoadmap() makes once, before any part: none of it changes while the view lives. */
export interface Fixed extends Dom {
  host: HTMLElement;
  options: ViewOptions;
  /** Ends every listener the view put on the page, at destroy(). */
  off: AbortController;
  once: { signal: AbortSignal };
  /** The keys go to the view only from this: the whole page, or the box it sits in. */
  keys: EventTarget;
  /** The point of a move, of the change of view, of the turn and of the flip of the labels that the address holds the page at, or null (see mountRoadmap()). */
  frozen: number | null;
  frozenU: number | null;
  frozenT: number | null;
  frozenW: number | null;
  /** Does the address hold the page still? Then the view keeps nothing. */
  still: boolean;
  /** Does the user ask for less motion? Then each move ends at once. */
  calm: MediaQueryList;
}

/** All that changes while the view lives. */
export interface State {
  // ---- the plan that is drawn, and what is drawn of it: all made again on each good show() ----

  plan: Plan | null;
  all: TNode[];
  K: number;
  hasIcons: boolean;
  byId: Map<string, TNode>;
  byKey: Map<string, TBranch>;
  byPod: Map<string, TSplit>;
  pods: TSplit[];
  /** The top-level branches the user showed or hid, by their tags, where that is not what they get by default: a finished one hidden, any other shown. */
  choices: Map<string, boolean>;
  /** Is the zoom control hidden down to its grip? */
  tucked: boolean;
  /** Is the 'Links' part of the side bar open? */
  linksOpen: boolean;
  /** Is 'Include private items' on? Then 'Export' saves the whole roadmap. */
  withPrivate: boolean;
  /** Is the plan drawn again for a branch shown or hidden? Then it keeps its place, as after a save of the file. */
  toggling: boolean;
  /** The layouts with the labels shown, then with them hidden. */
  setsBy: [Layouts, Layouts];
  /** The layouts of the labels that are asked for, across and down: of each, the view with marks, then the view with icons, each a layout for each level. */
  sets: Layouts;
  /** The layouts of the flow the plan is drawn in. */
  views: Layout[][];
  stopEls: HTMLButtonElement[];
  pieceEls: Map<string, SVGElement>;
  /** Under each line of a branch, a wide clear line that takes the pointer for it. */
  hitEls: Map<string, SVGElement>;
  /** The ring around the pill of a closed track that holds a step that just changed. */
  haloEls: Map<string, SVGElement>;
  nodeEls: Map<string, NodeEls>;
  podEls: Map<string, PodEls>;
  /** What is drawn of a step, or of a branch: its lines, its pill and its texts, and those of the branches in it. */
  partsOf: Map<Thing, Element[]>;
  /** Of the turn that is drawn: each line as its points at both ends. Made once for each turn, since neither end moves while it lasts. */
  turnLines: { A: Layout; Z: Layout; at: Map<string, [number[], number[]]> } | null;
  /** The text of the last good draw, and the widths the fonts gave it then. */
  shown: string;
  measured: string;

  // ---- the zoom: z runs from 0 to K, and a value between two levels draws the move from one to the other ----
  // ---- the two views: u runs from 0, marks, to 1, icons, and a value between draws the change from one to the other ----
  // ---- the two layouts: t runs from 0, across, to 1, down, and a value between draws the turn from one to the other ----
  // ---- the labels: w runs from 0, shown, to 1, hidden, and a value between draws the flip from one to the other ----

  /** Where the zoom is, and the level it rests at. */
  z: number;
  target: number;
  /** The move on its way, as its animation frame: a zoom, a change of view, a turn or a flip of the labels. */
  raf: number;
  /** How big the plan is drawn, on the screen against its units, and how wide and tall it is in them. */
  scale: number;
  wide: number;
  tall: number;
  /** The level the user asked for, and whether it was the last one: a plan whose shown branches have fewer levels draws the nearest, and the asked one comes back with them. */
  asked: number;
  askedLast: boolean;
  /** The view that is asked for, 0 or 1, and how far the page is on its way there. */
  view: number;
  u: number;
  /** The layout the plan is drawn in: across, or down; and how far the page is on its way there, 0 across and 1 down. */
  flow: 'h' | 'v';
  t: number;
  /** The layout the user picked, which holds for the visit; null until a pick, while the layout follows the size of the view (see fit). */
  pickFlow: 'h' | 'v' | null;
  /** Does the user want the icons shown? A plan that names no icon is drawn with marks, and the wish is kept for the next plan. */
  prefer: boolean;
  /** Does the user want the labels shown; and how far the page is on its way from them shown, 0, to them hidden, 1. */
  labels: boolean;
  w: number;
  /** The mode the view is drawn in: light, dark, or as the device is set. */
  mode: Mode;
  /** Where the switches in the popup left the plan since the user last moved it: at a level and a scale, the step they hold it by, and where that step was in the room in each mix of
   * the labels, the view and the layout the plan was in. A switch back to one of those mixes puts the plan back where it was in it, so any way back comes back to the same place.
   * The user's scroll, a new size, a pick or a redraw lets them go. */
  been: { id: string; target: number; mag: number; at: Map<string, [number, number]> } | null;

  // ---- the place of the plan in the room ----

  /** The step the view is held by while it moves: kept after the move, so that out and back in comes back to the same place; let go when the user moves the plan. */
  anchor: Hold | null;
  /** While the page scales: the point of the plan, at the level it is at, that stays at a point of the room. */
  pin: { x: number; y: number; px: number; py: number } | null;
  /** How far past its near end (its left or top) and its far end, across and down, the first view put a plan bigger than the room, so that an edge of the room cuts nothing there (see opening()).
   * The plan rests there, and every place and scroll after it may go as far: a scale, a new size, a redraw or a visit after does not pull it back. */
  beyond: Past;
  /** The scroll that the script set last, to tell it from a scroll by the user. */
  mine: [number, number];
  /** The scroll of the stage as last heard: a stage that gets smaller can cut its scroll before the view hears of the new size, and the view takes the place from this. */
  heard: [number, number];
  /** While the sheet at the bottom is open: the scroll before it opened, and the scroll its glides were going to. When it closes with the plan where they left it, the plan goes back. */
  sheetFrom: { at: [number, number]; to: [number, number] } | null;
  /** The size of the stage, read once for each size of the view and for each draw: read after a frame has moved the plan, it would make the page lay itself out at once. */
  stageSize: [number, number] | null;
  /** Where each step is in the frame drawn last, by its id, in units of the plan. */
  cur: Map<string, { x: number; y: number }>;
  /** Where the plan was put last: does it fit the room, and where its right end and its bottom are, counted from the corner of the room with nothing scrolled. */
  laid: { fits: boolean; right: number; bottom: number };
  /** The first view as it was put, until the user moves the page: a font that loads late, or a new size, then puts the first view again.
   * `moved` says the user scrolled it since. A scroll that only the stage getting smaller made is not the user's: the new size puts the first view again before it is heard. */
  opened: { target: number; view: number; mag: number; flow: 'h' | 'v'; labels: boolean; moved: boolean } | null;
  /** The size of the stage the plan was last drawn for, and the room it had then. */
  stageWas: number[];
  roomWas: [number, number];

  // ---- the size: every level draws at reading size, times the scale asked for ----

  /** The scale asked for, against reading size. */
  mag: number;
  /** While only a blocked step and its blockers show: the scale they need to all be in sight, which may be under LO. */
  floor: number | null;
  /** While only a blocked step and its blockers show: that step, its blockers, and where the page was, to go back to.
   * `x` and `y` are the point of the plan that was in the middle of the room, at the scale `mag`. */
  only: { n: TNode; keep: TNode[]; was: { mag: number; x: number; y: number } } | null;

  // ---- what moves now, and the timers ----

  /** The scale on its way, as its animation frame. */
  sraf: number;
  /** A smooth scroll is on its way. */
  gliding: boolean;
  /** A pinch on its way: its two fingers, how far apart they were and the scale then, and the point of the plan that was between them. */
  pinch: { a: number; b: number; d0: number; mag0: number; x: number; y: number } | null;
  /** The frame that draws the pinch where the fingers are. */
  praf: number;
  /** Safari's own pinch on its way: the scale then, and the point of the plan under the pointer, and where that is in the room. */
  gesture: { mag0: number; x: number; y: number; px: number; py: number } | null;
  /** The save that waits for a scroll to end. */
  saving: number;
  /** The end of the "just changed" look of a step. */
  tidy: number;

  // ---- the pointer, and what it points at ----

  /** A click before this time does nothing: the second click on the grip, as the zoom control moves under it, the click after two fingers on the control,
   * or the second click on a heading of the popup that lands out of the popup as it gets shorter.
   * Each time of the pointer is the time of its event (timeStamp): when the user pressed, not when a busy page got to the event. */
  noClick: number;
  /** When the last click on the view came, by the time of its event: a double click comes right after its second click, with no such time of its own. */
  clickedAt: number;
  /** A drag of the plan with the mouse: where it started, and the scroll then. Is it a drag yet, and no click? */
  drag: { x: number; y: number; l: number; t: number } | null;
  dragged: boolean;
  /** The kind of pointer that pressed last: after a finger, a tap picks a moment later, and nothing shows a tip. And when it pressed, by the time of its event. */
  lastPointer: string;
  pressedAt: number;
  /** What the pointer lights, with its tip. */
  hot: Thing | null;
  /** What is picked: it stays lit, and the side bar shows it. */
  picked: Thing | null;
  /** What a row of the side bar lights on the plan. */
  rowHot: Thing | null;
  /** What the side bar showed before what it shows now, the last one last. It is let go when the side bar closes. */
  past: Ref[];
  /** A tap that waits to pick, in case a second tap makes it a double tap. */
  tapWait: { x: number; y: number; t: number; timer: number; act: () => void } | null;
}

/** The state of a view that has drawn nothing yet. */
export function initialState(): State {
  const setsBy: [Layouts, Layouts] = [{ h: [], v: [] }, { h: [], v: [] }];
  return {
    plan: null, all: [], K: 0, hasIcons: false,
    byId: new Map(), byKey: new Map(), byPod: new Map(), pods: [],
    choices: new Map(), tucked: false, linksOpen: true, withPrivate: false, toggling: false,
    setsBy, sets: setsBy[0], views: [],
    stopEls: [], pieceEls: new Map(), hitEls: new Map(), haloEls: new Map(), nodeEls: new Map(), podEls: new Map(), partsOf: new Map(),
    turnLines: null, shown: '', measured: '',
    z: 0, target: 0, raf: 0, scale: 1, wide: 0, tall: 0,
    asked: 0, askedLast: false, view: 0, u: 0, flow: 'h', t: 0, pickFlow: null, prefer: true, labels: true, w: 0, mode: 'device', been: null,
    anchor: null, pin: null, beyond: { near: [0, 0], far: [0, 0] }, mine: [0, 0], heard: [0, 0], sheetFrom: null, stageSize: null,
    cur: new Map(), laid: { fits: true, right: 0, bottom: 0 }, opened: null, stageWas: [0, 0], roomWas: [1, 1],
    mag: 1, floor: null, only: null,
    sraf: 0, gliding: false, pinch: null, praf: 0, gesture: null, saving: 0, tidy: 0,
    noClick: 0, clickedAt: 0, drag: null, dragged: false, lastPointer: '', pressedAt: 0, hot: null, picked: null, rowHot: null, past: [], tapWait: null,
  };
}

/** One view: what it makes once, its state, and what each part gives the other parts, by the file of the part.
 * Each is named here, not taken whole from the type of a part: that type comes from what the function of the part gives back, and that function takes this context. */
export interface ViewContext extends Fixed, State {
  // draw.ts
  pills: DrawPart['pills']; draw: DrawPart['draw']; shut: DrawPart['shut']; stands: DrawPart['stands']; standFor: DrawPart['standFor'];
  // frame.ts
  least: FramePart['least']; size: FramePart['size']; frame: FramePart['frame'];
  // place.ts
  room: PlacePart['room']; place: PlacePart['place']; clear: PlacePart['clear']; at: PlacePart['at']; nearest: PlacePart['nearest']; roomOf: PlacePart['roomOf']; here: PlacePart['here']; ends: PlacePart['ends']; pastEnd: PlacePart['pastEnd']; rest: PlacePart['rest']; hold: PlacePart['hold'];
  // tidy.ts
  tidyPlace: TidyPart['tidyPlace']; tidyAt: TidyPart['tidyAt']; tidyHeld: TidyPart['tidyHeld'];
  // opening.ts
  middle: OpeningPart['middle']; firstView: OpeningPart['firstView']; firstReach: OpeningPart['firstReach']; columnOf: OpeningPart['columnOf']; untouched: OpeningPart['untouched'];
  // toolbar.ts
  controls: ToolbarPart['controls']; setPopup: ToolbarPart['setPopup']; placePopup: ToolbarPart['placePopup']; setTucked: ToolbarPart['setTucked']; setMode: ToolbarPart['setMode']; afterFold: ToolbarPart['afterFold'];
  // branches.ts
  fillBranches: BranchesPart['fillBranches']; setBranches: BranchesPart['setBranches']; placeBranches: BranchesPart['placeBranches'];
  // moves.ts
  flowT: MovesPart['flowT']; isDown: MovesPart['isDown']; labW: MovesPart['labW']; setFlow: MovesPart['setFlow']; endTurn: MovesPart['endTurn']; go: MovesPart['go']; setIcons: MovesPart['setIcons']; setLabels: MovesPart['setLabels']; endFlip: MovesPart['endFlip'];
  // store.ts
  save: StorePart['save']; kept: StorePart['kept']; start: StorePart['start'];
  // scale.ts
  scaleBy: ScalePart['scaleBy']; scaleTo: ScalePart['scaleTo']; endScale: ScalePart['endScale'];
  // scroll.ts
  moving: ScrollPart['moving']; glide: ScrollPart['glide']; sight: ScrollPart['sight'];
  // hover.ts
  thingAt: HoverPart['thingAt']; light: HoverPart['light']; hover: HoverPart['hover'];
  // facts.ts
  heading: FactsPart['heading'];
  // side.ts
  thingOf: SidePart['thingOf']; uncover: SidePart['uncover']; pick: SidePart['pick']; dropTap: SidePart['dropTap'];
  // aim.ts
  aim: AimPart['aim']; seek: AimPart['seek'];
  // blockers.ts
  showOnly: BlockersPart['showOnly']; fitOnly: BlockersPart['fitOnly']; endOnly: BlockersPart['endOnly']; nameKept: BlockersPart['nameKept'];
  // resize.ts
  resized: ResizePart['resized']; sizer: ResizePart['sizer'];
  // paint.ts
  fail: PaintPart['fail']; show: PaintPart['show']; paint: PaintPart['paint'];
  // error-list.ts
  list: ErrorListPart['list'];
  // fonts.ts
  measure: FontsPart['measure'];
  // export.ts
  resetExport: ExportPart['resetExport'];
}
