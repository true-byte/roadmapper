# Use the app

::: basics
The app shows your roadmap file in a browser, as a tree that the docs call the plan. The HTML export and the box of the lib work the same way.

The examples come from the sample roadmap file, 'Plant care app'.

::: details internals
The app is the page that shows one roadmap file in a browser. It draws the roadmap as a tree, which the docs call the plan.

The box of the lib and the page of the HTML export work the same way, except where [Embed a roadmap](05-embed.md) and [The HTML file and the HTML export](04-export.md) say otherwise. In this doc, the page is the area that shows the plan: the browser window in the app and in the HTML export, or the box of the lib.

The examples come from the sample roadmap file, 'Plant care app'.

::: internals
`src/app/main.ts` makes the app. It puts the view of `mountRoadmap()`, from `src/view/view.ts`, into the element `#app` of `src/app/index.html`.

The view is made of parts, one file each in `src/view/`, such as `side.ts` for the side bar. `mountRoadmap()` makes them in the order of the list `PARTS`. Each part reads and writes the state of its view in the context that `src/view/context.ts` defines. So two views on one page share nothing.

The options of `mountRoadmap()` set what the view has:

| Option | What it gives the view |
|---|---|
| `store` | The name that the view keeps its settings under, as [What it remembers](#what-it-remembers) says. With no `store`, the view keeps nothing. |
| `exportFile` | The part 'Export' of the popup. |
| `save` | 'Edit' on the zoom control, as [Edit on the page](#edit-on-the-page) says. |
| `box` | The element of another page that the view sits in as a box. With no `box`, the view is the whole page, and takes the keys and the wheel. |
| `icons` | The icons of this view only, in place of the icon set of the page. |
| `onDraw` | A call after each good draw. |

`src/app/main.ts` gives `store`, `exportFile` and `onDraw`, and gives `save` as [Edit on the page](#edit-on-the-page) says.

`readPlan()` in `src/view/plan.ts` reads the roadmap as a plan of steps (`TNode`), branches (`TBranch`), and groups and branchings (`TSplit`).
:::

## Open the app

::: basics
In a project that has Roadmapper installed, run this command. Then open the address that it prints.

```sh
npx roadmapper
```

To try the sample roadmap file, run:

```sh
npx roadmapper node_modules/roadmapper/roadmap/sample.roadmap.json
```

The page redraws each time you save the roadmap file.

::: details internals
In a project that has Roadmapper installed, run:

```sh
npx roadmapper
```

In a clone of Roadmapper, run:

```sh
npm run dev
```

Open the address that the command prints. While the page is open, it redraws each time you save the roadmap file, as [Redraw on save](#redraw-on-save) says. [Commands](02-commands.md) gives each option.

To open the sample roadmap file in a project, run:

```sh
npx roadmapper node_modules/roadmapper/roadmap/sample.roadmap.json
```

To open it in a clone, run:

```sh
npm run dev -- roadmap/sample.roadmap.json
```

::: internals
`npx roadmapper dev` serves `dist/cli/app.html`, the app page of the package, which holds no roadmap. On each load, `devServer()` in `src/cli/cli.ts` puts the roadmap into the slot of the page, `<script type="application/json" id="roadmap">`. The slot holds the text of the file, its name, its key and two addresses. `src/app/slot.ts` reads the slot.

| Address | What it carries |
|---|---|
| `/` | The app page, with the roadmap file as it is now in its slot. |
| `/events` | Each save of the roadmap file, as server-sent events. |
| `/save` | The roadmap that 'Save' sends, which the server writes into the file. |
| `/fonts/` | The font files of the theme. |

The server watches the folder of the file, not the file, because many editors save a file by putting a new file in its place. It reads the file 40 ms after the last change, and sends the text only when the text changed.

`npm run dev` runs `scripts/dev.mjs`. The script names the file to `vite.config.ts` in the environment variable `ROADMAP_FILE`, and passes the other arguments to Vite. The plugin `roadmapFile()` of `vite.config.ts` gives the page the text of the file as the module `virtual:roadmap`, and watches the file. On a save, Vite sends the new module, and `src/app/main.ts` takes it with `import.meta.hot.accept()`.

The page gets the roadmap file as text, not as a module of JSON. So a typo in the file shows in the error list of the page, not in the error screen of the dev server.
:::

## Levels

::: basics
A plan with a group has three levels: 'Main steps', 'Tracks' and 'Every step'. A plan with no group has one level, 'Every step'. [format.md, section "Groups and branchings"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md#groups-and-branchings) says what a group is.

| Level | What it shows |
|---|---|
| 'Main steps' | Each group shows as one step, such as 'Sharing build'. |
| 'Tracks' | Each group opens into a frame. A track that holds no group is a pill, with how many of its steps are done. |
| 'Every step' | Every group opens, down to each step. |

Each level draws at reading size. A level that is bigger than the page scrolls.

::: details internals
A plan with a group has three levels: 'Main steps', 'Tracks' and 'Every step'. A plan with no group has one level, 'Every step'. [format.md, section "Groups and branchings"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md#groups-and-branchings) says what a group is.

| Level | What it shows |
|---|---|
| 'Main steps' | Each branch shows its own steps. Each group on it shows as one step with the group's `name`, such as 'Sharing build'. A group with no `name` shows the names of its tracks, where they fit. Where they do not fit, the group shows how many tracks it has, such as '3 tracks', or 'Group' for a group of one track. |
| 'Tracks' | Every group, at every depth, opens into a frame with a thin line and a faint fill. The `name` of the group sits over the top left corner of the frame. A track that holds a group is open, such as the track 'Code' of 'Sharing build'. A track that holds no group is a pill: the mark of the state of the track, and how many of its steps are done. The track 'Tests' shows '0/1'. |
| 'Every step' | Every group opens, down to each step. |

Every level draws at reading size: the name of a step is 15.6 px on every screen. No level shrinks to fit the page. A level that is bigger than the page scrolls.

::: internals
`readPlan()` in `src/view/plan.ts` gives `K`, the last level. It is 2 when a branch is inside a group, and 0 otherwise. So a plan has three levels, however deep its groups are. `levelName()` gives the name of each level.

Only the top-level branches that show count for `K`. When the hidden branches hold the only groups, the plan has one level. The level that you asked for comes back once they show again: the context keeps it in `asked` and `askedLast`.

`shutAt()` says where a track is a pill: at 'Tracks', for a track that holds no group. A branch of a branching is never a track. So it is open wherever the branch that it leaves is open.

A group with no `name` shows the names of its tracks, with commas between them. It does so when every track has a name, and the list fits on the 3 lines of the name of a step.

The 15.6 px is `READ` in `src/view/frame.ts`, 1.2, times the 13 px that `src/view/view.css` gives a name. `size()` in `frame.ts` draws each level at `READ` times the scale that you asked for, as far as that level allows.
:::

## Zoom and move

::: basics
| Do this | What happens |
|---|---|
| Click '−' or '+' on the zoom control at the bottom of the page. | The plan goes out or in by one level. |
| Click a level on the zoom control. | The plan goes to that level. |
| Double click or double tap the plan. | The plan goes in by one level. |
| Pinch, or hold Ctrl and turn the wheel. | The plan grows or shrinks. |
| Turn the wheel, drag the plan, or swipe with one finger. | The plan moves. |

::: details internals
| Do this | What happens |
|---|---|
| Click '−' or '+' on the zoom control at the bottom of the page. | The plan goes out or in by one level. |
| Click a level on the zoom control. | The plan goes to that level. |
| Double click or double tap the plan. | The plan goes in by one level. The step nearest the point that you clicked or tapped keeps its place, as far as the plan allows. At the last level, nothing happens. A single click or tap never changes the level. |
| Pinch, or hold Ctrl and turn the wheel. | The plan grows or shrinks, and the level stays the same. The point under the pointer, or between the fingers, keeps its place, as far as the plan allows. Two fingers also move the plan. The browser never zooms the page. |
| Turn the wheel, drag the plan, or swipe with one finger. | The plan moves, where it is bigger than the page or where part of it is under the side bar. |
| Click the tab on the top edge of the zoom control. | The zoom control hides below the bottom edge of the page, except for its tab. A second click on the tab brings it back. The keys still work. |

When you pinch or turn the wheel with Ctrl, the plan grows up to 3 times reading size. It shrinks until the whole level fits, or to a fourth of reading size if that comes first.

::: internals
`go()` in `src/view/moves.ts` moves the plan to a level. The move takes 420 ms, plus 260 ms for each level that it passes.

`makeDom()` in `src/view/dom.ts` makes the zoom control, the element `nav.zoom`. In `src/view/input.ts`, a press on its stops goes to the level under the point where the press ends. A press while another finger is on the view changes nothing.

A double click is the `dblclick` event of the stage. It does nothing after a drag, or while 'Show only blockers' is on. A double tap is a second tap within 300 ms and 30 px of the first, as `TAP` in `src/view/side.ts` sets.

`scaleBy()` in `src/view/scale.ts` scales the plan for the wheel with Ctrl or Cmd. A wheel event counts at most 25 px, so one notch scales the plan by about a fourth at most. A wheel that counts in lines counts 32 px for each line.

`MAG` in `src/view/frame.ts` sets the two limits of the scale, as `LO` and `HI`. `least()` gives the smallest scale of a level: where the whole level fits the room, and never above reading size.

`touchPart()` in `src/view/touch.ts` takes a pinch only from two fingers that came down on the plan or the head. Once a frame, the scale follows how far apart they are, and the plan follows the point between them. When one finger lifts, the plan follows the other. A third finger changes nothing.

Two fingers do nothing while the level changes, or while 'Show only blockers' is on. The pinch events of the browser, `gesturestart` and `gesturechange`, scale the plan around the pointer on a trackpad. On a touch screen, the view stops them.

One finger scrolls the stage in the browser's own way: the stage has `touch-action: pan-x pan-y` in `src/view/view.css`. A drag with the mouse starts once the pointer has moved 5 px.

The tab is the button `.grip`. `setTucked()` in `src/view/toolbar.ts` gives the view the class `tucked`. It makes '−', the stops, '+', 'Branches' and 'Tools' `inert`. The tip of the tab says 'Hide toolbar', or 'Show toolbar' while the zoom control is hidden.
:::

## Which step keeps its place

::: basics
When you change the level, or click a switch in 'Tools', one step keeps its place on the page. When you set the switches back as they were, the plan goes back to where it was.

::: details internals
When the zoom control, a key or a switch changes the plan, one step keeps its place on the page. That step comes from the first rule in this list that finds a step:

1. After 'Hide labels', 'Horizontal' or 'Vertical', it is the picked step.
2. After a change of level, or a switch between icons and marks, it is the step that the last such change kept in place. This rule ends when you move the plan.
3. It is the step in progress nearest the middle of the page, of those in sight.
4. It is the step that the page first opened on, if that step is in sight.
5. It is the step nearest the middle of the page.

A step that is not drawn is in sight when the pill of its track is in sight. At 'Main steps', such a step is in sight when the step of its group is in sight.

When you set the switches back as they were, in any order, the plan goes back to where it was. This holds only when nothing else moved the plan in between.

The words "as far as the plan allows" mean that two rules come first:

- The plan never scrolls past its ends, except as far as it went past them when the page first opened.
- When the plan fits the page across, or up and down, it stays whole on the page in that direction.

When either rule stops the plan, the point that should keep its place moves.

::: internals
The step that keeps its place is the `anchor` of the context, a `Hold` of `src/view/place.ts`. `hold()` works out where that step goes in every layout: across and down, with marks and icons, and with the labels shown and hidden. So a change of layout, or of the labels, keeps it in place too.

| Rule | Code |
|---|---|
| 1 | `switchHold()` in `src/view/moves.ts`, which `turnTo()` and `setLabels()` call with the picked step. |
| 2 | The `anchor` that `go()` and `setIcons()` find. A scroll by you sets `anchor` to `null`, in `src/view/scroll.ts`. |
| 3 to 5 | `middle()` in `src/view/opening.ts`. Rule 4 takes the step that `now()` gives. |

The context keeps `been`: the step that the switches hold the plan by, and where it was in each mix of labels, view and layout. `backTo()` in `moves.ts` puts the plan back there. A scroll by you, a new size, a pick, a redraw, a new level or a new scale lets `been` go.

`standFor()` in `src/view/draw.ts` gives what stands for a step that is not drawn. That is the pill of its track, or at 'Main steps' the step of its group.

`ends()` and `rest()` in `place.ts` keep the plan between its ends. The context keeps in `beyond` how far past its ends the first view put the plan.

After a change of level, `tidyAt()` in `src/view/tidy.ts` moves the plan a short way. The edges then cut the least of its steps, names and pills in two. It moves the plan up to 160 px, or 35% of the room if that is less. After a double click, it does so only when the plan runs down.
:::

## Tools

::: basics
Click the button with a gear on the zoom control. Its tip says 'Tools'. It opens a popup with three parts:

| Part | What it is for |
|---|---|
| 'Key' | It shows what the mark of each state on the plan means. [format.md, section "States"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md#states) gives each mark. |
| 'View' | It hides the icons or the labels, draws the page light or dark, and makes the plan run across or down. |
| 'Export' | Its button 'Export' saves the HTML export of the roadmap, as [Export from the app](04-export.md#export-from-the-app) says. |

Click outside the popup and the zoom control to close it.

::: details internals
The button 'Tools' opens the popup. The popup holds three parts:

| Part | What it holds |
|---|---|
| 'Key' | The legend of the marks |
| 'View' | The switches 'Hide node icons' and 'Hide labels', then 'Device', 'Light' and 'Dark' at the left and 'Horizontal' and 'Vertical' at the right |
| 'Export' | The switch 'Include private items', then the button 'Export' |

| Do this | What happens |
|---|---|
| Click the button with a gear on the zoom control, at its right end or to the left of 'Edit'. Its tip says 'Tools'. | The popup opens. A click on a switch changes only that setting, and the popup stays open. |
| Click the heading of a part, such as 'Key'. | The part closes, and only its heading shows. A second click on the heading opens the part again. |
| Click outside the popup and the zoom control. | The popup closes. That click does nothing else on the plan, and neither does a double click or double tap that starts with it. |
| Click 'Hide node icons'. | The steps switch between their icons and the marks of their states. The switch shows only when a step names an icon that is in the icon set. |
| Click 'Hide labels'. | The plan hides every word except the names of the top-level branches, and the steps move closer together. The tip and the side bar still show every name. |
| Click 'Device', 'Light' or 'Dark'. | 'Light' draws the whole page light, and 'Dark' draws it dark, whatever the device is set to. 'Device' draws the page light or dark as the device is set, and follows a change of that setting. |
| Click 'Horizontal' or 'Vertical'. | 'Horizontal' makes the plan run across, with each name over its step. 'Vertical' makes the plan run down, with each name to the right of its step. The choice stays when the page changes size. |
| Click 'Include private items'. | The switch turns on or off. With it on, the button 'Export' saves the whole roadmap, with its private items. |
| Click the button 'Export'. | The browser saves `roadmap.zip`, the HTML export of the roadmap, as [Export from the app](04-export.md#export-from-the-app) says. The button shows a check and 'Saved' for 2 seconds. |

Each part is open the first time the page opens. A part that you close stays closed until you open it again, also when the page opens again.

When you open the popup with the keyboard, the focus goes to the first switch in 'View'. While 'View' is closed, the focus goes to the heading 'Key'.

The legend lists only the states that are on the plan. It also lists the milestone when the plan has one. [format.md, section "States"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md#states) gives each mark.

::: internals
`makeDom()` in `src/view/dom.ts` makes the popup, a `div` with the role `dialog`. Each part comes from `foldPart()`, and its heading is a button with `aria-expanded`.

`setPopup()` in `src/view/toolbar.ts` opens and closes the popup. Opening it closes the list of branches. Where the side bar is a panel at the bottom of the page, it closes the side bar too. The popup does not open while 'Show only blockers' is on.

`placePopup()` puts the popup 30 px over the zoom control (`OVER`), with its right edge on the right edge of the control. The popup stays 8 px in from the left of the view. It scrolls where the view is too short for it.

Each switch is a button with the role `switch` and `aria-checked`. 'Device', 'Light' and 'Dark' are one `radiogroup`, and so are 'Horizontal' and 'Vertical'. In each, an arrow key moves to the button beside and picks it.

`setMode()` writes the mode into the attribute `data-mode` of the view, and `view.css` sets the `color-scheme` of the view from it. Each color of the theme is a `light-dark()` value, so the `color-scheme` picks it. While the mode changes, the attribute `data-turning` turns off every transition, so the whole view changes at once.

`setFlow()`, `setIcons()` and `setLabels()` in `src/view/moves.ts` run the switches. A change to the other layout takes 600 ms. A switch between icons and marks, or of the labels, takes 420 ms.

`draw()` in `src/view/draw.ts` fills the legend with each state that a step on the plan has, in the order of `STATES`. It shows 'Hide node icons' only when a step that shows names an icon of the icon set: `hasIcons` of the plan.
:::

## Branches

::: basics
The button with a stack of layers, to the left of 'Tools', opens the list of top-level branches. Its tip says 'Branches'. It shows only when the plan has two or more top-level branches.

Click a row of the list to show or hide its branch.

A top-level branch whose steps are all done or canceled stays hidden until you show it. In 'Plant care app', 'V1' is hidden when the page first opens.

::: details internals
| Do this | What happens |
|---|---|
| Click the button with a stack of layers, to the left of the button 'Tools'. Its tip says 'Branches'. | The list of top-level branches opens over the zoom control. It holds a search box, then one row for each branch. Each row holds a check box, the mark of the branch's state, its name, and how many of its steps are done. The check box is ticked while the branch shows. The button shows only when the plan has two or more top-level branches. |
| Click a row. | That branch shows or hides, and the list stays open. The last branch that shows cannot be hidden. |
| Type in the search box. | The list keeps only the rows whose names contain the text. The search ignores upper and lower case. |
| Click outside the list and the zoom control. | The list closes. |

- A top-level branch whose steps are all done or canceled is hidden, until you show it in the list. In 'Plant care app', 'V1' is hidden when the page first opens.
- A branch that you show or hide in the list stays that way.
- When you set a branch back to how it shows by itself, the list forgets your choice. The branch then hides once all its steps are done or canceled.
- When every top-level branch has all its steps done or canceled, the last branch shows.
- A hidden branch is not drawn. The count at the top counts only the steps of the branches that show. In 'Plant care app', it says '3 of 18 steps done' while 'V1' is hidden.

::: internals
`fillBranches()` in `src/view/branches.ts` makes one row for each top-level branch, in the order of the file. A branch with no name shows as 'Branch'. Each row is a button with the role `checkbox`. The row of the last branch that shows gets `aria-disabled="true"`.

The search drops the spaces at the ends of the text. It lowers the case of the text and of each name with `toLocaleLowerCase()`.

`showBranch()` keeps your choice in `choices` of the context, by the tag of the branch. The tag is the name of the branch, or `#` and its place, such as `#2`. `tagOf()` in `src/view/plan.ts` takes the place for a branch with no name. It also takes it when another top-level branch has the same name, or when the name starts with `#`.

Then `paint()` draws the plan again, with `toggling` on, so that the plan keeps its level and its place.

`readPlan()` marks each step of a hidden branch `hidden`. Such a step stays in the plan only as what a shown step waits for. `finished()` is true for a branch that has steps, each of them done or canceled.

`draw()` in `src/view/draw.ts` writes the count at the top from the steps that show. It counts the steps that are done, of the steps that are not canceled. `draw()` also hides or shows the button 'Branches'.

`setBranches()` opens the list, closes the popup and empties the search. It puts the focus in the search box, except after a touch, so that the keyboard of a phone does not cover the list. `placeBranches()` puts the list 30 px over the zoom control, as for the popup.
:::

## Edit on the page

::: basics
The app that `npx roadmapper` or `npm run dev` serves has the button 'Edit' at the right end of the zoom control. The roadmap file changes only when you click 'Save'.

| Do this | What happens |
|---|---|
| Click 'Edit'. | A gold frame shows around the page, and 'Cancel' and 'Save' take the place of 'Edit'. |
| Point near the line of a branch, and click the gold diamond with a '+'. | Three icons show: a step, a branching of two branches, and a group of one track. A click on one adds it there. |
| Drag a step, a branch or a group. | Gold marks show each gap where it can go, and the drop moves it there. |
| Pick a step, a branch or a group. | The side bar shows each of its keys as a field. |
| Click 'Save' or 'Cancel'. | 'Save' writes the roadmap file. 'Cancel' drops every change since 'Edit'. |

::: details internals
The app that `npx roadmapper` or `npm run dev` serves has the button 'Edit' at the right end of the zoom control. The roadmap file changes only when you click 'Save'. A built page opened from disk, the HTML export and the box of the lib have no 'Edit'.

| Do this | What happens |
|---|---|
| Click 'Edit'. | A gold frame shows around the page, and 'Cancel' and 'Save' take the place of 'Edit'. The level stays as it is. 'Save' stays gray until something changes. |
| Point near the line of a branch. | A gold diamond with a '+' shows at the gap of that branch nearest the pointer: between two items, before the first item, or after the last. |
| Click the gold diamond. | Three icons show: a step, a branching of two branches, and a group of one track. A click on one adds it at that gap. |
| Point where a branching or a group parts. | A dashed line runs to the place among its branches nearest the pointer. A click on the '+' at its end adds a branch there, or a track in a group. |
| Click the '+' under the last top-level branch. | A new top-level branch is added after the last one. |
| Point at a step, or pick it. | A trash can shows under the step. A click on it deletes the step, and takes it out of each `waitsFor`. |
| Drag a step. | Gold marks show each gap where it can go. On the line of a branch, or near it, the mark of that line nearest the pointer grows, and the drop moves the step there. A drop far from every line, or where the step already is, changes nothing. |
| Drag a branch by its name or its line. | The gold marks show only among its sisters: the branches of its branching, the tracks of its group, or the top-level branches. |
| Drag a group. | At 'Main steps' you drag the step that stands for the group. At 'Tracks' and 'Every step' you drag its frame or its name. The gold marks show each gap where it can go, in any branch but its own tracks, and the group moves with all it holds. |
| Pick a step, a branch or a group. | The side bar shows each of its keys as a field. Each change draws the plan again. A field whose value the file check refuses turns red, and the plan stays as it was drawn last. |
| Press `Ctrl+Z` or `Ctrl+Shift+Z`. | The last change since 'Edit' is undone, or the last undo is done again. |
| Click 'Cancel'. | Every change since 'Edit' is dropped, and the page leaves edit mode. |
| Click 'Save'. | The roadmap file gets the roadmap as the page shows it, and the page leaves edit mode. When the file check refuses the roadmap, 'Save' turns red and shows the name of the error. |

- Each new branch and each new track holds one new step. The new step is picked, with its name ready to type over.
- A new step gets its id from its name, as [SKILL.md, section "The keys of a step"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/SKILL.md#the-keys-of-a-step) says. In 'Plant care app', a new step named 'Plant shop design' gets the id `plant-shop-design`.
- The side bar of a step holds its icon, its name, its state, 'Milestone', 'Private', 'Waits for', 'Links', 'Why', 'Done when', 'Planned' and 'Deadline'. A click on the icon opens a grid of icons with a search box.
- A drag near an edge of the page scrolls the plan.
- A finger does not drag. A tap near the line of a branch shows the gold diamond, and a tap where a branching or a group parts shows the dashed line.
- In edit mode, a save of the roadmap file does not redraw the plan. 'Save' writes over that file, and 'Cancel' draws it.
- When you leave the page with changes that are not saved, the browser asks whether to leave.

::: internals
`editPart()` in `src/view/edit.ts` makes 'Edit', 'Cancel' and 'Save'. `src/app/main.ts` gives the option `save` only when the page has the address `/save`, which only a dev server sets. A page that `npx roadmapper build` writes has no such address. 'Edit' does nothing while the error list shows.

In edit mode, the page changes a copy of the roadmap in memory: an `EditHistory` of `src/roadmap/edit.ts`. Each change is a function of that file, such as `addItem()`, `moveStep()` or `setStep()`. The function gives a new roadmap, or refuses the change with the errors of the file check.

The keys typed in one field make one change, which one undo takes back. The plan draws again 250 ms after the last key (`TYPING_MS`). `Ctrl+Y` also does the last undo again, and Cmd works in place of Ctrl.

'Save' sends the roadmap as JSON to `/save`, with `send()` in `src/app/main.ts`. [Install in your project](01-intro.md#internals/install-in-your-project) says how the dev server writes the file. When the server refuses the roadmap, 'Save' shows the name of its first error. When the save fails in any other way, 'Save' shows 'Not saved'.

A change that you make while a save is on its way keeps the page in edit mode, so that you can save it too. 'Cancel' does nothing until the save ends.

`showFile()` keeps each text that the page gets in edit mode for 'Cancel'. The browser asks whether to leave through a `beforeunload` listener, while the roadmap differs from the one at 'Edit'.

`src/view/edit-marks.ts` draws the marks on the plan, and runs the drags. Within 48 px of an edge of the page, a drag scrolls the plan by up to 18 px a frame (`EDGE` and `SPEED`). `src/view/edit-side.ts` makes the fields of the side bar. Its grid shows 96 icons at once (`GRID_MAX`), and the search finds the others.
:::

## Tips and the side bar

::: basics
Point at a step, a group or a branch, and a tip shows its name. A step or a group also shows its state, and a branch shows how many of its steps are done.

Click or tap a step, a group or a branch to pick it. The side bar then shows all that the roadmap file says about it. Click empty space, or click '×', to close the side bar.

::: details internals
| Do this | What happens |
|---|---|
| Point at a step, a group or a branch. | It lights up, and a tip shows its name and one line about it. The tip of a step or a group shows its state. The tip of a branch or a group shows how many of its steps are done. A touch shows no tip. |
| Click or tap a step, a group or a branch. | It is picked: it stays lit in gold, and the side bar shows all that the roadmap file says about it. A tap acts after 300 ms, because it may be the first tap of a double tap. |
| Click or tap empty space, or click '×'. | The side bar closes. |
| Point at a name in the side bar. | A ring shows around the step, group or branch of that name on the plan. When that step, group or branch is out of sight, an arrow at the edge of the page points to it. A step in a hidden branch is not on the plan, so it gets no ring and no arrow. In the side bar, that step has a tag with the name of its top-level branch. |
| Click the back arrow at the top left of the side bar. | The side bar shows what it showed before. When the side bar closes, it forgets what it showed. |
| Click a link under 'Links' in the side bar. | The page of the link opens in a new tab. In 'Plant care app', 'User survey' has the link 'Survey results'. |
| Click 'Links' in the side bar. | The links of every step hide, or show again. |

::: internals
`hoverPart()` in `src/view/hover.ts` finds the thing under the pointer by an attribute of its element. It is `data-id` for a step, `data-pod` for a group, and `data-bar` for a branch.

The line of the tip is the `why` of a step, or the `holds` of a branch. A group says what it opens into. With one track, it names up to 4 of its steps. With a `name` of its own and a name on each track, it names up to 4 tracks. Otherwise, it says how many tracks it has. In 'Plant care app', the tip of 'Sharing build' says 'Opens into Code and Tests.'

The tip stands 10 px over the thing, or 4 px over it where the room is tight, or else 10 px under it. It stays 8 px in from each side of the view.

A thing under the pointer gets the class `hot`, and a picked thing gets the class `picked`. `src/view/view.css` draws a picked thing in gold.

`pick()` in `src/view/side.ts` picks a thing, and closes the popup and the list of branches. `sideOf()` fills the side bar in this order:

1. '×', then the back arrow and the path of the branches around the thing.
2. The name, then its facts, which `facts()` in `src/view/facts.ts` also gives the tip. A step or a group shows its state. A branch or a group shows a bar and its count, such as '3 of 13 done' for 'V2'. A milestone has the tag 'Milestone', and a private item the tag 'Private'.
3. For a step: 'Blocked by', 'Links', 'Why', 'Done when', 'Planned' and 'Deadline'. For a branch: its `holds`, then 'In it'. For a group: 'In it'.

'Planned' shows its two days with 'to' between them, and '?' for a day that the step does not have. A day shows as in 'Mar 4, 2026'.

The back arrow goes back through `past` of the context: what the side bar showed, the last one last. `thingOf()` finds a step again by its id, and a branch or a group by its name and its steps.

A finger held down for more than 500 ms picks nothing (`TAP` in `side.ts`).

`aimPart()` in `src/view/aim.ts` draws the ring 8 px out from the thing. A step, a pill or a group drawn as one step is in sight when its middle is. An open branch or an open group is in sight when 40 px of it across and 16 px of it up and down show. The arrow stands 34 px in from the edge of the part of the page where the plan shows.

A link opens with `target="_blank"` and `rel="noopener noreferrer"`. Its row shows the `icon` of the link, when the icon set has that icon.
:::

## Blockers

::: basics
[format.md, section "States"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md#states) says what makes a step blocked. In 'Plant care app', the 'User survey' of 'V3' is blocked: it waits for 'Release V2'.

Click 'Show only blockers' in the side bar of a blocked step. Everything on the page fades, except the step and its blockers. Click 'Show all', and the page goes back to how it was.

::: details internals
[format.md, section "States"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md#states) says what makes a step blocked. In 'Plant care app', the 'User survey' of 'V3' is blocked: it waits for 'Release V2'.

- Click 'Show only blockers' in the side bar of a blocked step. Everything on the page fades, except the step and those of its blockers that are on the plan. Where the labels show, the names of these steps are at reading size. The plan shrinks as far as it must to bring them all into sight, even below a fourth of reading size. The level and the layout do not change, and the step and its blockers stay in sight.
- Click 'Show all', or click empty space. The side bar, the scale and the place of the plan go back to how they were before 'Show only blockers'.

::: internals
`blockersPart()` in `src/view/blockers.ts` runs 'Show only blockers'. `showOnly()` keeps the step, and each of its `blockers()` that is not in a hidden branch. `blockers()` in `src/view/plan.ts` gives the steps of its `waitsFor` that are neither done nor canceled. The button shows only when one of them is on the plan.

The view gets the class `only`. `src/view/view.css` then blurs all else by 3 px, fades it to an opacity of 0.3, and takes the pointer from it. It also hides the side bar.

The names are `div` elements of the layer `.names`, each on 3 lines at most and at most 130 px wide. The name of the blocked step is gold.

`fitOnly()` picks the scale where the step, its blockers and their names fit the room. Across, it keeps 72 px for names at each side, and 48 px over and under. Down, it keeps 130 px right of the steps, and 32 px over and under. With the labels hidden, it keeps 24 px all around.

`fitOnly()` never scales in past the scale from before. Through `floor` of the context, it can scale out past `MAG.LO`. A new size of the page fits them again.

While 'Show only blockers' is on, the icons, the labels, the popup and the list of branches also stay as they are. `endOnly()` brings back the scale and the place that `only.was` kept. 'Show all', `Esc`, a click on empty space and a pick call it.

A redraw of the same text, such as when a font loads, keeps 'Show only blockers' on. A new text of the roadmap file ends it.
:::

## Keys

::: basics
| Key | What happens |
|---|---|
| `+` or `-` | The plan goes in or out by one level. |
| `I` | The steps switch between their icons and the marks of their states. |
| An arrow key | The plan moves. |
| `Esc` | It closes the popup, the list of branches or the side bar, one for each press. |

::: details internals
| Key | What happens |
|---|---|
| `+` or `=` | The plan goes in by one level. |
| `-` or `_` | The plan goes out by one level. |
| `I` | The steps switch between their icons and the marks of their states, as 'Hide node icons' does. |
| An arrow key | The plan moves. |
| `Esc` | Each press does one thing. It closes the popup or the list of branches. When neither is open, it ends 'Show only blockers'. When that is off too, it closes the side bar. |

A key pressed with Ctrl, Alt or Cmd does nothing in the app, except `Ctrl+Z` and `Ctrl+Shift+Z` in edit mode, as [Edit on the page](#edit-on-the-page) says. While the error list shows, no key does anything.

::: internals
`inputPart()` in `src/view/input.ts` takes the keys. An arrow key scrolls the stage by 80 px (`PAN`). A held `I` acts once, since a repeat of the key does nothing.

When `Esc` closes the popup, the focus goes back to 'Tools'. In the search box, `Esc` closes the list of branches, and the focus goes back to 'Branches'.

At the first level, `controls()` in `src/view/toolbar.ts` gives '−' the attribute `aria-disabled="true"`. At the last level, it gives that attribute to '+'. Neither gets `disabled`, so both keep the focus of the keyboard.
:::

## What it remembers

::: basics
When you reload the app, or open it again, the page shows the plan as you left it. It keeps the level, the place of the plan, the switches and the side bar. Each roadmap file keeps its own.

The first time, the app opens at 'Main steps', around the first step in progress.

::: details internals
When you reload the app, or open it again, the page shows the plan as you left it. The app remembers these settings:

- the level
- icons or marks
- whether the labels show
- the layout that you picked
- the scale
- the place of the plan
- the top-level branches that you showed or hid in the list
- whether the zoom control is hidden
- the picked step, group or branch, with its side bar
- what the back arrow of the side bar goes back to
- how far down the side bar is scrolled
- whether the links in the side bar are hidden
- whether 'Show only blockers' is on
- whether the popup is open, and which of its parts are closed
- 'Device', 'Light' or 'Dark'
- whether 'Include private items' is on
- whether the list of branches is open

The app keeps them in the browser's local storage, apart for each roadmap file, by the full path of the file. So a save of the file keeps them, and two roadmap files never share them.

When a setting names a step, group or branch that is gone from the roadmap file, that setting starts as it does the first time. The other settings come back.

The first time, the app opens this way:

| Setting | The first time |
|---|---|
| Level | 'Main steps', or 'Every step' in a plan with no group |
| Scale | Reading size |
| Icons and labels | Shown |
| Side bar | Closed |
| Links in the side bar | Shown |
| 'Show only blockers' | Off |
| Popup | Closed, with each part open |
| 'Include private items' | Off |
| Light or dark | 'Device' |
| List of branches | Closed |
| Top-level branches | Shown, except each one whose steps are all done or canceled |
| Place | Around the first step in progress, or, with no step in progress, around the first step that can start |

When the plan runs across, the name of that step's branch shows in full if the step is first on a top-level branch. It also shows in full if the step is on a branch of a branching.

The plan can then move a short way. It moves to where the edges of the page and the zoom control cut the least of its names, steps and pills in two. The step stays whole in this move, and so does the name of its branch where that name shows in full. Near an end of the plan, this move can go a little past that end.

::: internals
The name in `localStorage` is `roadmapper.app.` followed by the key of the file (`src/app/main.ts`). `fileKey()` in `src/cli/key.ts` gives the key: the first 16 hex digits of the SHA-256 of the full path. So the page never shows where the file is.

An older version of the app kept the settings of every file under the one name `roadmapper.app`. The first page that finds that name starts from it, where its own file has nothing kept, and removes it.

`save()` in `src/view/store.ts` writes the settings as JSON, of the type `Kept`. It writes them when a setting changes, 200 ms after a scroll of the plan or the side bar ends, and on `pagehide`. With no storage, it keeps nothing.

`save()` writes nothing while the address holds the page still, as [CONTRIBUTING.md, section "Hold the page still"](https://github.com/true-byte/roadmapper/blob/master/CONTRIBUTING.md#hold-the-page-still) says. It also writes nothing for a plan with no step.

The place is the id of the step nearest the middle of the stage. With it, the view keeps where that step is, as parts of the width and the height of the stage. The level is kept with `last`. So a level kept at 'Every step' stays 'Every step' when the file gets more levels.

`readKept()` reads the JSON back. It drops each setting of the wrong kind, as if it were not kept. A text with no whole number as its `level` gives nothing back.

The view puts the settings back in this order:

1. `mountRoadmap()` sets the mode, before the first draw.
2. `paint()` in `src/view/paint.ts` reads the top-level branches that you showed or hid.
3. `start()` in `store.ts` sets the level, icons or marks, the labels, the layout and the scale. Then it sets the zoom control, 'Links', 'Include private items' and the parts of the popup.
4. `start()` picks the step, group or branch, with what the back arrow goes back to.
5. `start()` puts the plan in its place, or else in the first view.
6. `start()` sets the scroll of the side bar, 'Show only blockers', and the popup or the list of branches.

The popup and the list do not open again while the zoom control is hidden. Nor do they open where a thing is picked and the side bar is a panel at the bottom.

The script tag of the app page has `blocking="render"`, which the plugin `firstPaint` of `vite.config.ts` adds. So the page paints nothing before the view runs, and its first paint has the mode that you picked.

`opening()` in `src/view/opening.ts` makes the first view, around the step that `now()` gives. When the plan runs across, a level that fits the room goes in its middle. Otherwise, the step goes 40% across the room, or further left so that the end of its top-level branch shows. The name of its branch stays at least 12 px into the room.

When the plan runs down, `openingDown()` puts the step 40% down the room. A level that fits the width of the room goes in the middle of that width.

`tidyPlace()` in `src/view/tidy.ts` makes the short move. When the plan runs across, the move is up to 120 px each way, or 30% of the room if that is less. When the plan runs down, it is up to 60 px or 15% sideways, and up to 200 px or 30% up and down.

Until you move the plan, a font that loads late, or a new size of the page, makes the first view again. The context keeps the first view in `opened`, and `untouched()` says whether the first view is still as it was put.
:::

## Redraw on save

::: basics
When you save the roadmap file, the plan redraws by itself. It keeps the same level. It also keeps the place of the plan, unless the page is still as it first opened. A step that is new, or whose state changed, gets a gold ring.

When the file has an error, the error list shows in place of the plan. Save the file with no error, and the plan comes back.

::: details internals
When you save the roadmap file, the plan redraws by itself. It keeps the same level, icons or marks, labels and layout. It also keeps the place of the plan, unless the page is still as it first opened. Then the plan takes the place that it has the first time, as [What it remembers](#what-it-remembers) says. A picked step, group or branch stays picked and shows its new data, also when new items come before it in the file. When it is no longer in the file, the side bar closes.

A step that is new, or whose state changed, grows into place, and a gold ring spreads out from it. When the step is out of sight, the page scrolls to it. When the step is not drawn at that level, the ring spreads from the pill of its track. At 'Main steps', the ring spreads from the step of its group. The level does not change.

When the file has an error, the error list shows in place of the plan. The error list shows:

- the title of the roadmap, when the text is JSON
- the name of the file
- how many errors the file has
- a row for each error, with the columns 'Line', 'Where', 'Key', 'Error' and 'Value', as `validate` prints them

The next save with no error brings the plan back as it was.

In edit mode, the plan does not redraw on save, as [Edit on the page](#edit-on-the-page) says.

::: internals
`got()` in `src/app/main.ts` hands each new text to `show()` of the view. It skips a text that is the same as the last one. After 'Save', `send()` sets the last text to the text that the server writes, so the event of that save draws nothing again.

`show()` in `src/view/paint.ts` checks the text with `checkRoadmap()` of `src/roadmap/check.ts`. A text that the check refuses goes to `list()` in `src/view/error-list.ts`. The error list takes every wheel, touch and click, so the plan under it gets none.

For a good text, `paint()` asks `untouched()` whether the first view is still as it was put. If it is, `firstView()` puts the first view again. If not, `paint()` keeps the step nearest the middle of the stage that is still in the file, and puts that step back where it was. A branch shown or hidden in the list never puts the first view again. It finds the pick again as the back arrow does, by `thingOf()` in `src/view/side.ts`.

A step is new, or its state changed, when `nodeStates()` of `src/roadmap/states.ts` gives it another state than at the last draw. At the first draw, no step counts as changed.

A changed step keeps its look for 3000 ms (`FRESH_MS`). A second save in that time does not start the look again: `draw()` sets a negative `animation-delay` from the age of the change.

The gold ring is the element `.halo`. `view.css` plays its animation `ring` twice, 1.4 s each time. With reduced motion, the ring stands still around the step until the look ends.

In its `onDraw`, the app sets the title of the browser tab to the `title` of the roadmap, followed by ` · roadmap`.
:::

## Small screens

::: basics
- When the page is less than 664 px wide or less than 500 px high, the zoom control has no '−' and '+'. Click a level to change the level.
- When the page is less than 664 px wide, the side bar is a panel at the bottom of the page.
- When the page is less than 664 px wide and taller than it is wide, as on a phone held upright, the plan runs down.

::: details internals
- When the page is less than 664 px wide or less than 500 px high, the zoom control has no '−' and '+'. It keeps the levels, 'Branches' and 'Tools'. A click on a level changes the level, and the keys still work.
- On such a page, 'Edit', 'Cancel' and 'Save' show only their icons. In edit mode, 'Cancel' and 'Save' take the place of 'Branches' and 'Tools'.
- When the page is less than 664 px wide, the side bar is a panel at the bottom of the page. The list of branches is then as wide as the page, minus 8 px on each side.
- Until you pick 'Horizontal' or 'Vertical', the layout follows the shape of the page. The plan runs down when the page is less than 664 px wide and taller than it is wide, as on a phone held upright. Otherwise, the plan runs across. The layout changes when the page turns or changes size.
- When the plan runs down on a phone and the labels show, a branching of many branches is wider than the page. So the plan also moves sideways there.

::: internals
The sizes come from container queries in `src/view/view.css`. The view's own element has `container-type: size`, so the size of the view counts, not the size of the window.

`view.css` tells the script two things by CSS variables of the stage. `--sheet: bottom` says that the side bar is a panel at the bottom. `--flow: down` says that the plan runs down until you pick a layout. `readFit()` in `src/view/dom.ts` reads them.

A `ResizeObserver` in `src/view/resize.ts` calls `resized()` each time the stage or the zoom control changes size. `resized()` reads the two variables again. The rule for `--flow: down` leaves out a box of the lib: it holds only for `.roadmap:not(.box)`.

When a new size changes the layout, the plan changes at once, with no animation. The picked step, or else the step in the middle, stays at the same part of the room. While 'Show only blockers' is on, the layout waits until it ends.

On a page less than 664 px wide, the panel is 8 px in from each side, and at most 40% of the page high. Its close button and its back arrow are 44 px wide, for a finger. They are 44 px on a page less than 500 px high too.

When you pick a thing that the panel covers, `uncover()` in `src/view/side.ts` scrolls the plan. The thing then sits in the middle of the part of the plan over the panel. When the panel closes and nothing moved the plan since, the plan goes back to where it was.

Under 330 px wide, each stop of the zoom control keeps room for two lines, so the zoom control is taller. On a page with 'Edit', this starts under 440 px wide.

On a page less than 664 px wide, each row of the error list takes two lines. The first line says where the error is, and the second gives its key, error and value. The row of the column names hides.
:::

## How the plan draws

::: basics
[format.md](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md) says what each piece of the roadmap file means. On the page, the top-level branches all start at the same place on the left. With icons shown, a step that names an icon is a circle with the icon on it.

The fonts come with Roadmapper, so the page needs no network for them.

::: details internals
[format.md](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md) says what each piece of the roadmap file means and how groups and branchings draw. [Levels](#levels) says what each level shows. The page also follows these rules:

- The top-level branches all start at the same place on the left.
- At 'Main steps', with the labels shown, each top-level branch ends with how many of its steps are done. In 'Plant care app', 'V2' ends with '3 of 13 done'.
- A branch of a branching comes back to the line it left. It comes back as soon as no other branch is drawn between it and that line.
- When the plan runs across, the first branch of a branching runs over the line, and the others run under it. When every branch of a branching ends on its own, they all run under the line, such as 'Plan B' on the branch 'Photo ID'.
- When the plan runs down, every line runs down, and each name is to the right of its step. The branches of a split are drawn to the right of the line they leave, side by side, in the order of the file.
- In a split with many branches, the outer curves are so close together that they look like one line.
- With the labels hidden, a pill shows no count. It is a short rounded bar with the mark in the middle.
- With icons shown, a step that names an icon is a circle with the icon on it. The mark of its state is on the edge of the circle. The icon is dimmer while the step has not started.
- At 'Main steps', with icons shown, a group is such a circle too. Its drawing shows what the group holds: tracks side by side, such as 'Sharing build', or steps in a row, such as 'Beta test'.
- A name of a step wraps between words. Each line is no wider than the space between two steps, measured in the theme's font.
- When the plan runs down, a line of a name is as wide as the space to the right of its branch. That space is widest on a top-level branch and narrowest in a track.
- The space over a branch grows for a name of 3 lines. So no name runs into another name, a step, a frame or a caption.
- When the plan runs across, a name is much nearer to its own step than to the step of the branch over it.
- The fonts come with Roadmapper, from the folder `fonts/` next to the page of the app, the lib of the box or the page of the HTML export. They need no network. The page asks no other host for them.
- The plan draws in fallback fonts until a font of the theme has loaded. Then the names wrap again in that font. The rest of the page stays as it was, with 'Show only blockers' on or off.
- When the system asks for reduced motion, the plan changes its level, layout, icons, labels and place at once, with no animation.

::: internals
`layouts()` in `src/view/layout.ts` lays out each level ahead: with marks and with icons, across and down, and with the labels shown and hidden. One piece of code lays out both directions, along a line and across it. `frame()` in `src/view/frame.ts` draws each frame of a move as a mix of two of these layouts.

Each view has its own sizes in `layout.ts`. With the labels shown, a step is 112 units from the next step across (`C.DX`). With the labels hidden, it is 44 units with marks and 56 units with icons.

A unit is 1.2 px at reading size. A line of the name of a step is at most 100 units wide (`NAME_W` in `src/view/plan.ts`). `wrap()` takes the fewest lines, and of those, the split whose widest line is the narrowest.

Down, the width of a line comes from `NAME_V`. It is 232 px at reading size on a top-level branch, 100 units on a branch of a branching, and 80 units in a track.

`measure()` in `src/view/fonts.ts` measures each kind of text on a canvas, in the font that the theme sets on it. When a font of the theme loads and the widths change, `paint()` draws the same text again. [Fonts](05-embed.md#internals/fonts) says how the fonts load.

With reduced motion, the media query `(prefers-reduced-motion: reduce)` matches, and each move ends at once. `view.css` plays its animations only under `(prefers-reduced-motion: no-preference)`.
:::

## Long text

::: basics
A text that is too long for its place is cut, and ends with `…`. The tip shows the whole name, and the side bar shows the whole text.

::: details internals
The plan and the rows of the side bar cut a long text, and end it with `…`. The tip shows the whole name, and the side bar shows the whole text.

| Place | How a long text shows |
|---|---|
| The title of the roadmap, at the top of the page | It takes one line, and a longer title is cut. The count of steps done is never cut. |
| The name of a step on the plan | It takes 3 lines at most, and a longer name is cut. |
| The name of a branch on the plan | It takes one line, and a longer name is cut. |
| The name of a group, over its frame | It takes one line, and a longer name is cut. |
| The tip | It shows the whole name. Its line about the step, group or branch takes 2 lines at most, and a longer line is cut. |
| The path and the name at the top of the side bar, 'Why' and 'Done when' | They show the whole text. The path wraps between words. The side bar scrolls up and down. |
| A row under 'In it' or 'Blocked by' | Its name takes 2 lines at most, and a longer name is cut. Its count is never cut. A click on the row shows the whole name, except on the row of a step in a hidden branch. Point at that row while its name or its tag is cut, and the browser's tip shows the whole name of the step and of its branch. |
| A row under 'Links' | Its name takes one line, and a longer name is cut. The arrow comes right after the name. Point at a cut link, and the browser's tip shows its whole name. |
| The tag of a step in a hidden branch | It takes one line, and a longer name is cut. The tag is at most half as wide as its row. |
| A row in the list of branches | Its name takes 2 lines at most, and a longer name is cut. Its count is never cut. |

A touch shows no browser tip. So on a phone or a tablet, a row under 'Links', the row of a step in a hidden branch and its tag show the whole name, on as many lines as it needs.

A word too wide for its line, such as a web address, breaks inside the word. On the plan, the `…` never comes right after a space or a mark such as a comma. Nothing on the page or in the side bar scrolls sideways.

::: internals
`wrap()` in `src/view/plan.ts` writes the name of a step on 3 lines at most (`LINES`). A name that needs more lines fills its first two lines, and is cut on the third. A word wider than a line breaks where it reaches the width of the line.

`cutLine()` cuts a name to one line: the name of a branch at 200 units (`CAP_W`), and the name of a group at 250 units (`GNAME_W`). Before the `…`, `cutEnd()` drops each space and each of the marks `,`, `;`, `:`, `.`, `-`, `–` and `—`.

The tip, the side bar and the list of branches cut their texts in CSS, in `src/view/view.css`, with `-webkit-line-clamp` or `text-overflow: ellipsis`. The tip is at most 280 px wide, and the side bar at the side of the page is 320 px wide.

A `ResizeObserver` in `src/view/side.ts` watches each row under 'Links', and the row of each step in a hidden branch. While a part of a row is cut, the row gets a `title` with its whole text. Once all of it shows, the `title` goes. On a device with no hover, `@media (hover: none)` in `view.css` cuts neither row.
:::
