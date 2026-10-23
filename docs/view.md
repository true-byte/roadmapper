# Use the app

This doc covers the app: the page that shows one roadmap file in a browser. The app draws the roadmap as a tree, which the docs call the plan. This doc defines the levels of the plan and says what each control does.

The box of the lib and the page of the HTML export work the same way, except where [embed.md](embed.md) and [export.md](export.md) say otherwise. In this doc, the page is the area that shows the plan: the browser window in the app and in the HTML export, or the box of the lib.

The examples come from the sample roadmap file, 'Plant care app'.

## Open the app

In a project that has Roadmapper installed, run:

```sh
npx roadmapper dev
```

In a clone of Roadmapper, run:

```sh
npm run dev
```

Open the address that the command prints. While the page is open, it redraws each time you save the roadmap file, as [Redraw on save](#redraw-on-save) says. [commands.md](commands.md) gives each option.

To open the sample roadmap file in a project, run:

```sh
npx roadmapper dev node_modules/roadmapper/data/sample.roadmap.json
```

To open it in a clone, run:

```sh
npm run dev -- data/sample.roadmap.json
```

## Levels

A plan with a group has three levels: 'Main steps', 'Tracks' and 'Every step'. A plan with no group has one level, 'Every step'. [format.md, section "Groups and branchings"](https://github.com/true-byte/roadmapper/blob/main/.claude/skills/roadmapper/format.md#groups-and-branchings) says what a group is.

| Level | What it shows |
|---|---|
| 'Main steps' | Each branch shows its own steps. Each group on it shows as one step with the group's `name`, such as 'Sharing build'. A group with no `name` shows the names of its tracks, where they fit. Where they do not fit, the group shows how many tracks it has, such as '3 tracks', or 'Group' for a group of one track. |
| 'Tracks' | Every group, at every depth, opens into a frame with a thin line and a faint fill. The `name` of the group sits over the top left corner of the frame. A track that holds a group is open, such as the track 'Code' of 'Sharing build'. A track that holds no group is a pill: the mark of the state of the track, and how many of its steps are done. The track 'Tests' shows '0/1'. |
| 'Every step' | Every group opens, down to each step. |

Every level draws at reading size: the name of a step is 15.6 px on every screen. No level shrinks to fit the page. A level that is bigger than the page scrolls.

## Zoom and move

| Do this | What happens |
|---|---|
| Click '−' or '+' on the zoom control at the bottom of the page. | The plan goes out or in by one level. |
| Click a level on the zoom control. | The plan goes to that level. |
| Double click or double tap the plan. | The plan goes in by one level. The step nearest the point that you clicked or tapped keeps its place, as far as the plan allows. At the last level, nothing happens. A single click or tap never changes the level. |
| Pinch, or hold Ctrl and turn the wheel. | The plan grows or shrinks, and the level stays the same. The point under the pointer, or between the fingers, keeps its place, as far as the plan allows. Two fingers also move the plan. The browser never zooms the page. |
| Turn the wheel, drag the plan, or swipe with one finger. | The plan moves, where it is bigger than the page or where part of it is under the side bar. |
| Click the tab on the top edge of the zoom control. | The zoom control hides below the bottom edge of the page, except for its tab. A second click on the tab brings it back. The keys still work. |

When you pinch or turn the wheel with Ctrl, the plan grows up to 3 times reading size. It shrinks until the whole level fits, or to a fourth of reading size if that comes first.

## Which step keeps its place

When the zoom control, a key or a switch changes the plan, one step keeps its place on the page. That step comes from the first rule in this list that finds a step:

1. After 'Hide labels', 'Horizontal' or 'Vertical', it is the picked step.
2. After a change of level, or a switch between icons and marks, it is the step that the last such change kept in place. This rule ends when you move the plan.
3. It is the step in progress nearest the middle of the page.
4. It is the step that the page first opened on, if that step is in sight.
5. It is the step nearest the middle of the page.

A step that is not drawn is in sight when the pill of its track is in sight. At 'Main steps', such a step is in sight when the step of its group is in sight.

When you set the switches back as they were, in any order, the plan goes back to where it was. This holds only when nothing else moved the plan in between.

The words "as far as the plan allows" mean that two rules come first:

- The plan never scrolls past its ends, except as far as it went past them when the page first opened.
- When the plan fits the page across, or up and down, it stays whole on the page in that direction.

When either rule stops the plan, the point that should keep its place moves.

## The popup

| Do this | What happens |
|---|---|
| Click the (i) button at the right end of the zoom control. Its tip says 'Key'. | The popup opens. It holds the legend of the marks, and the switches 'Hide node icons', 'Hide labels', 'Device', 'Light', 'Dark', 'Horizontal' and 'Vertical'. Under them are the switch 'Include private items' and the button 'Export'. A click on a switch changes only that setting, and the popup stays open. |
| Click outside the popup and the zoom control. | The popup closes. That click does nothing else on the plan, and neither does a double click or double tap that starts with it. |
| Click 'Hide node icons'. | The steps switch between their icons and the marks of their states. The switch shows only when a step names an icon that is in the icon set. |
| Click 'Hide labels'. | The plan hides every word except the names of the top-level branches, and the steps move closer together. The tip and the side bar still show every name. |
| Click 'Device', 'Light' or 'Dark'. | 'Light' draws the whole page light, and 'Dark' draws it dark, whatever the device is set to. 'Device' draws the page light or dark as the device is set, and follows a change of that setting. |
| Click 'Horizontal' or 'Vertical'. | 'Horizontal' makes the plan run across, with each name over its step. 'Vertical' makes the plan run down, with each name to the right of its step. The choice stays when the page changes size. |
| Click 'Include private items'. | The switch turns on or off. With it on, 'Export' saves the whole roadmap, with its private items. |
| Click 'Export'. | The browser saves `roadmap.zip`, the HTML export of the roadmap, as [export.md, section "Export from the app"](export.md#export-from-the-app) says. The button shows a check and 'Saved' for 2 seconds. |

The legend lists only the states that are on the plan. It also lists the milestone when the plan has one. [format.md, section "States"](https://github.com/true-byte/roadmapper/blob/main/.claude/skills/roadmapper/format.md#states) gives each mark.

## Branches

| Do this | What happens |
|---|---|
| Click the button with a stack of layers, to the left of the (i) button. Its tip says 'Branches'. | The list of top-level branches opens over the zoom control. It holds a search box, then one row for each branch. Each row holds a check box, the mark of the branch's state, its name, and how many of its steps are done. The check box is ticked while the branch shows. The button shows only when the plan has two or more top-level branches. |
| Click a row. | That branch shows or hides, and the list stays open. The last branch that shows cannot be hidden. |
| Type in the search box. | The list keeps only the rows whose names contain the text. The search ignores upper and lower case. |
| Click outside the list and the zoom control. | The list closes. |

- A top-level branch whose steps are all done or canceled is hidden, until you show it in the list. In 'Plant care app', 'V1' is hidden when the page first opens.
- A branch that you show or hide in the list stays that way.
- When you set a branch back to how it shows by itself, the list forgets your choice. The branch then hides once all its steps are done or canceled.
- When every top-level branch has all its steps done or canceled, the last branch shows.
- A hidden branch is not drawn. The count at the top counts only the steps of the branches that show. In 'Plant care app', it says '3 of 18 steps done' while 'V1' is hidden.

## Tips and the side bar

| Do this | What happens |
|---|---|
| Point at a step, a group or a branch. | It lights up, and a tip shows its name, its state and one line about it. A touch shows no tip. |
| Click or tap a step, a group or a branch. | It is picked: it stays lit in gold, and the side bar shows all that the roadmap file says about it. A tap acts after 300 ms, because it may be the first tap of a double tap. |
| Click or tap empty space, or click '×'. | The side bar closes. |
| Point at a name in the side bar. | A ring shows around the step, group or branch of that name on the plan. When that step, group or branch is out of sight, an arrow at the edge of the page points to it. A step in a hidden branch is not on the plan, so it gets no ring and no arrow. In the side bar, that step has a tag with the name of its top-level branch. |
| Click the back arrow at the top left of the side bar. | The side bar shows what it showed before. When the side bar closes, it forgets what it showed. |
| Click a link under 'Links' in the side bar. | The page of the link opens in a new tab. In 'Plant care app', 'User survey' has the link 'Survey results'. |
| Click 'Links' in the side bar. | The links of every step hide, or show again. |

## Blockers

[format.md, section "States"](https://github.com/true-byte/roadmapper/blob/main/.claude/skills/roadmapper/format.md#states) says what makes a step blocked. In 'Plant care app', the 'User survey' of 'V3' is blocked: it waits for 'Release V2'.

- Click 'Show only blockers' in the side bar of a blocked step. Everything on the page fades, except the step and those of its blockers that are on the plan. Where the labels show, the names of these steps are at reading size. The plan shrinks as far as it must to bring them all into sight, even below a fourth of reading size. The level and the layout do not change, and the step and its blockers stay in sight.
- Click 'Show all', or click empty space. The side bar, the scale and the place of the plan go back to how they were before 'Show only blockers'.

## Keys

| Key | What happens |
|---|---|
| `+` or `=` | The plan goes in by one level. |
| `-` or `_` | The plan goes out by one level. |
| `I` | The steps switch between their icons and the marks of their states, as 'Hide node icons' does. |
| An arrow key | The plan moves. |
| `Esc` | Each press does one thing. It closes the popup or the list of branches. When neither is open, it ends 'Show only blockers'. When that is off too, it closes the side bar. |

A key pressed with Ctrl, Alt or Cmd does nothing in the app. While the error list shows, no key does anything.

## What it remembers

The app remembers these settings, and opens with them the next time:

- the level
- icons or marks
- whether the labels show
- the layout that you picked
- the scale
- the place of the plan
- the top-level branches that you showed or hid in the list
- whether the zoom control is hidden
- whether the links in the side bar are hidden
- whether 'Include private items' is on
- 'Device', 'Light' or 'Dark'

The app keeps them in the browser's local storage, under the same name for every roadmap file. So every app page on the same site shares the same settings.

The first time, the app opens this way:

| Setting | The first time |
|---|---|
| Level | 'Main steps', or 'Every step' in a plan with no group |
| Scale | Reading size |
| Icons and labels | Shown |
| Links in the side bar | Shown |
| 'Include private items' | Off |
| Light or dark | 'Device' |
| Top-level branches | Shown, except each one whose steps are all done or canceled |
| Place | Around the first step in progress, or, with no step in progress, around the first step that can start |

When the plan runs across, the name of that step's branch shows in full if the step is first on a top-level branch. It also shows in full if the step is on a branch of a branching.

The plan can then move a short way. It moves to where the edges of the page and the zoom control cut the least of its names, steps and pills in two. The step stays whole in this move, and so does the name of its branch where that name shows in full. Near an end of the plan, this move can go a little past that end.

## Redraw on save

When you save the roadmap file, the plan redraws by itself. It keeps the same level, icons or marks, labels, layout and place. A picked step, group or branch stays picked and shows its new data, also when new items come before it in the file. When it is no longer in the file, the side bar closes.

A step that is new, or whose state changed, grows into place, and a gold ring spreads out from it. When the step is out of sight, the page scrolls to it. When the step is not drawn at that level, the ring spreads from the pill of its track. At 'Main steps', the ring spreads from the step of its group. The level does not change.

When the file has an error, the error list shows in place of the plan. The error list shows:

- the title of the roadmap, when the text is JSON
- the name of the file
- how many errors the file has
- a row for each error, with the columns 'Line', 'Where', 'Key', 'Error' and 'Value', as `validate` prints them

The next save with no error brings the plan back as it was.

## Small screens

- When the page is less than 664 px wide or less than 500 px high, the zoom control shows only the levels. A click on a level changes the level, and the keys still work.
- When the page is less than 664 px wide, the side bar is a panel at the bottom of the page. The list of branches is then as wide as the page, minus 8 px on each side.
- Until you pick 'Horizontal' or 'Vertical', the layout follows the shape of the page. The plan runs down when the page is less than 664 px wide and taller than it is wide, as on a phone held upright. Otherwise, the plan runs across. The layout changes when the page turns or changes size.
- When the plan runs down on a phone and the labels show, a branching of many branches is wider than the page. So the plan also moves sideways there.

## How the plan draws

[format.md](https://github.com/true-byte/roadmapper/blob/main/.claude/skills/roadmapper/format.md) says what each piece of the roadmap file means and how groups and branchings draw. [Levels](#levels) says what each level shows. The page also follows these rules:

- The top-level branches all start at the same place on the left.
- At 'Main steps', with the labels shown, each top-level branch ends with how many of its steps are done. In 'Plant care app', 'V2' ends with '3 of 13 done'.
- A branch of a branching comes back to the line it left. It comes back as soon as no other branch is drawn between it and that line.
- When the plan runs across, the first branch of a branching runs over the line, and the others run under it. When every branch of a branching ends on its own, they all run under the line, such as 'Plan B' on the branch 'Photo ID'.
- When the plan runs down, every line runs down, and each name is to the right of its step. The branches of a split are drawn to the right of the line they leave, side by side, in the order of the file.
- In a split with many branches, the outer curves are so close together that they look like one line.
- With the labels hidden, a pill shows no count. It is a short rounded bar with the mark in the middle.
- With icons shown, a step that names an icon is a circle with the icon on it. The mark of its state is on the edge of the circle. The icon is dimmer while the step has not started.
- At 'Main steps', with icons shown, a group is such a circle too. Its drawing shows what the group holds: tracks side by side, such as 'Sharing build', or steps in a row, such as 'Beta test'.
- A name wraps onto at most 3 lines. Each line is no wider than the space between two steps, measured in the theme's font.
- When the plan runs down, a line of a name is as wide as the space to the right of its branch. That space is widest on a top-level branch and narrowest in a track.
- A word too wide for a line breaks inside the word. Only a name longer than 3 lines is cut, and ends with `…`. The tip and the side bar show the full name.
- The space over a branch grows for a name of 3 lines. So no name runs into another name, a step, a frame or a caption.
- When the plan runs across, a name is much nearer to its own step than to the step of the branch over it.
- The fonts come from Google Fonts, in the app, in the box of the lib and in the HTML export. With no network, the plan draws in fallback fonts. When a web font of the theme loads, the names wrap again in that font.
- When the system asks for reduced motion, the plan changes its level, layout, icons, labels and place at once, with no animation.
