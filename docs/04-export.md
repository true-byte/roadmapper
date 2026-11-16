# The HTML file and the HTML export

::: basics
A roadmap goes into files in two ways. The HTML file is for you, and the HTML export is for strangers, on a site.

::: details internals
A roadmap goes into files in two ways: the HTML file for you, and the HTML export for strangers. [Commands](02-commands.md#details) gives the commands that write them, their folders and their errors.

::: internals
This table gives the source of each part that this doc covers:

| Part | Source |
|---|---|
| The commands `build`, `export` and `preview` | `src/cli/cli.ts` |
| The app page, which the HTML file holds | `src/app/index.html` and `src/app/main.ts` |
| The page and the `roadmap.json` of the export | `src/cli/export.ts` |
| The roadmap that a stranger sees | `src/roadmap/public.ts` |
| The `roadmapper.js` of the export | `src/lib/export-script.ts` and `src/lib/element.ts` |
| 'Export' in the app | `src/app/export.ts`, `src/app/zip.ts` and `src/view/export.ts` |
:::

The examples come from the sample roadmap file, 'Plant care app'.

## Which one to use

::: basics
| | The HTML file | The HTML export |
|---|---|---|
| Who it is for | You | Strangers, on a site |
| Command | `npx roadmapper build` | `npx roadmapper export` |
| Private items | Shown | Left out |

::: details internals
| | The HTML file | The HTML export |
|---|---|---|
| Who it is for | You | Strangers, on a site |
| Command | `npx roadmapper build` | `npx roadmapper export` |
| Files | `index.html` and the folder `fonts/` | `roadmap.html`, `roadmap.json`, `roadmapper.js` and the folder `fonts/` |
| Private items | Shown | Left out, unless you add `--private` |
| Opens from disk | Yes | Yes |
| Remembers the view | Yes, as the app does | No |

::: internals
`src/app/main.ts` gives `mountRoadmap()` the options `store` and `exportFile`. The tag of the lib gives neither, as [In the box](05-embed.md#internals/in-the-box) says. So, of the two, only the HTML file remembers the view and has the part 'Export' in its popup.

The HTML file keeps its view in local storage under `roadmapper.app.` followed by the key of the roadmap file. `fileKey()` in `src/cli/key.ts` makes that key, a hash of the full path of the file.
:::

## The HTML file

::: basics
The HTML file is the page of the app, with the roadmap inside it. Its fonts load from the folder `fonts/` next to it, so keep the two together.

The file works like the app, as [Use the app](03-use-the-app.md) says. When the roadmap file changes, the page does not redraw. To show a change, run `npx roadmapper build` again.

::: details internals
- It is the app page with the roadmap inside it: one file that holds the script, the styles and the roadmap. It loads the fonts from the folder `fonts/` next to it, so keep the two together.
- It works like the app, as [Use the app](03-use-the-app.md) says. It does not redraw when the roadmap file changes. To show a change, run `npx roadmapper build` again.
- It shows the private items, so it is for you only. Strangers get the HTML export.
- In a clone, `npm run preview` serves it the way a site does.

::: internals
`run()` in `src/cli/cli.ts` makes the HTML file in this order:

1. It checks that the roadmap file exists.
2. It reads the names of the font files. Then it checks the folder that `build` writes into.
3. It reads the roadmap file, and checks it with `checkRoadmap()`.
4. It reads `dist/cli/app.html`, the app page with no roadmap in it. `vite-plugin-singlefile` put the script and the styles of the app inside that one file.
5. `fillPage()` puts the roadmap into the slot of the page, `<script type="application/json" id="roadmap">`. The slot holds the text of the roadmap file, the name of the file and its key.
6. `fillPage()` writes each `<` of the slot as `\u003c`, so no text of the roadmap can end the script.
7. It writes the page as `index.html`.
8. It copies the folder of the font files next to the page, as `fonts/`. That folder is `dist/lib/fonts/` of the package, or the folder `fonts/` of the theme in a clone.

When the page opens, `src/app/slot.ts` reads the slot. The slot of a build holds no `live` address and no `save` address, which `npx roadmapper dev` puts in. So `src/app/main.ts` opens no `EventSource` for the saves of the file. It also gives `mountRoadmap()` no `save`, which 'Edit' needs.

The page finds each font file at `fonts/<file>` from its own address, `document.baseURI`. `themeFonts('page')` in `src/themes/fonts.ts` writes these addresses into the script of the page.
:::

## The files of the export

::: basics
| File | What it is |
|---|---|
| `roadmap.html` | The page of the export. |
| `roadmap.json` | The roadmap that a stranger sees. |
| `roadmapper.js` | The lib of the export, which reads `roadmap.json` and draws it. |
| `fonts/` | The fonts of the theme. |

::: details internals
| File | What it is |
|---|---|
| `roadmap.html` | The page of the export. It holds a copy of `roadmap.json`, which it draws only when it cannot read `roadmap.json`, as when you open it from disk. |
| `roadmap.json` | The roadmap that a stranger sees, with no private item. It also holds the drawings of the icons that it names, and of the icons that the view draws itself, such as the gear of 'Tools'. |
| `roadmapper.js` | The lib of the export, which reads `roadmap.json` and draws it. It is not the `roadmapper.js` of the lib: [Which roadmapper.js is which](05-embed.md#which-roadmapperjs-is-which) tells them apart. |
| `fonts/` | The fonts of the theme, with their license texts. The lib loads them from this folder. |

::: internals
`FILES` in `src/cli/export.ts` names the three files. `exportFiles()` makes `roadmap.json` and `roadmap.html` from the text of the roadmap file, in this order:

1. It checks the text with `checkRoadmap()`.
2. Without the option `private`, it takes the roadmap that `publicRoadmap()` gives, as [Private items](#private-items) says.
3. It takes the drawings from the icon set that `--icon-set` of the theme names. The icons that the view draws itself are those of `ARROW`, `TOOLS`, `MODE`, `BRANCHES` and `GRIP` in `src/icons/icons.ts`. The icons of `LINKS`, for the 'Links' part of the side bar, go in only when a step has a link.
4. It writes `roadmap.json` as one line of JSON. Its key `icons` holds `set`, `size`, `license` and `icons`: the name of the set, the size of its drawings, its license and the drawings.
5. It writes the same JSON inside the tag of `roadmap.html`, with each `<` as `\u003c`.

`run()` then writes `roadmapper.js`, `roadmap.json` and `roadmap.html`, in this order. Last, it copies the same folder of font files as `build`.

The lib of the export finds the folder `fonts/` by its own address, as the plain script of the lib does. [In a page with no bundler](05-embed.md#internals/in-a-page-with-no-bundler) says how.
:::

## Export from the app

::: basics
The app and the HTML file can also save the export, as one file.

1. Click the button 'Tools', the button with a gear on the zoom control.
2. Click the button 'Export' in the part 'Export'.

The browser saves `roadmap.zip`, which holds the files of the export. Unzip it, then open its `roadmap.html`.

::: details internals
The app and the HTML file can also save the export, as one file.

1. Click the button 'Tools', the button with a gear on the zoom control.
2. To export the whole roadmap, turn on 'Include private items' in the part 'Export'.
3. Click the button 'Export' under that switch.

The browser saves `roadmap.zip`. It holds the files and the folder `fonts/` that `npx roadmapper export` writes for the same roadmap file. With 'Include private items' on, it holds what `npx roadmapper export --private` writes. Unzip it. Then open its `roadmap.html`, or upload all that it holds as [Put the export on a site](#put-the-export-on-a-site) says.

When every item is private, the export for strangers has nothing to show. With 'Include private items' off, the button then shows the mark of a blocked step and the error `Nothing public` in red. The browser saves nothing. Turn on 'Include private items' to export the whole roadmap.

::: internals
- `src/app/main.ts` loads `src/app/export.ts` at the first press of 'Export'.
- `exportZip()` gets the text of the last roadmap that the page drew with no error. It gets 'Include private items' as the option `private`.
- `exportZip()` makes `roadmap.html` and `roadmap.json` with `exportFiles()`, as `npx roadmapper export` does.
- `vite.config.ts` builds the lib of the export with `vite.lib.config.ts`. It puts the lib into the app page as the module `virtual:export-lib`. The module holds the lib gzipped, in base64, and each font file in base64.
- `exportZip()` unpacks the lib with the browser's `DecompressionStream`.
- `zip()` in `src/app/zip.ts` puts `roadmap.html`, `roadmap.json`, `roadmapper.js` and then each font file, as `fonts/<file>`, into `roadmap.zip`. It stores each file as it is, with no compression.
- `exportPart()` in `src/view/export.ts` draws the button. A press while the export is being made does nothing.
- The button shows the name of a `RoadmapError`, such as `Nothing public`.
- Any other error shows 'Export' with the mark of a blocked step. The console then shows `Roadmapper: the export was not made.`
- An error stays in the button until the next press, a new text of the roadmap, or a close of the popup. A click on 'Include private items' also clears it.
:::

## Put the export on a site

::: basics
1. Export the roadmap, and check the export before you upload it:

   ```sh
   npx roadmapper export
   npx roadmapper preview
   ```

2. Upload the three files and the folder `fonts/` into one folder of the site. Upload the `roadmap.json` of the export, never your roadmap file: anyone can read what is on a site.

The page is at the address of that folder plus `roadmap.html`.

::: details internals
1. Export the roadmap, and check the export before you upload it:

   ```sh
   npx roadmapper export
   npx roadmapper preview
   ```

   Without `--private`, `npx roadmapper preview` serves only `dist/export/`, the folder that `npx roadmapper export` writes into when you name no folder. So run `npx roadmapper export` with no folder.

2. Upload the three files and the folder `fonts/` into one folder of the site. Upload the `roadmap.json` of the export, never your roadmap file: anyone can read what is on a site.

The page is at the address of that folder plus `roadmap.html`. On a host that drops the `.html`, the page is at that address plus `roadmap`.

::: internals
`previewServer()` in `src/cli/cli.ts` serves the export the way a site does:

- It serves `dist/export/`, or `dist/export-private/` with `--private`. `preview` takes no folder.
- It serves only the three files of the export and the files of its folder `fonts/`. Any other address gets the status 404 and the text `Not found`.
- It also serves `roadmap.html` at the address `/roadmap`, as a host that drops the `.html` does.
- It sends each file with `cache-control: no-cache`, so a new export shows on the next load.
:::

## Show the export in a page of the site

::: basics
To show the roadmap in a page that your site already has, put the `roadmapper.js`, the `roadmap.json` and the folder `fonts/` of the export next to that page. Then add these two lines to the page:

```html
<script src="roadmapper.js" defer></script>
<roadmapper-view src="roadmap.json"></roadmapper-view>
```

::: details internals
To show the roadmap in a page that the site already has:

1. Put the `roadmapper.js`, the `roadmap.json` and the folder `fonts/` of the export next to that page.
2. Put these two lines in the page:

   ```html
   <script src="roadmapper.js" defer></script>
   <roadmapper-view src="roadmap.json"></roadmapper-view>
   ```

3. Set the size of the box, as [Size and look](05-embed.md#size-and-look) says.

::: internals
These two lines hold less than `roadmap.html` does:

- Their `<script>` has no `onerror` and no `onload`.
- Their tag has no attribute `page`. So the tag is a box in the page, as [The tag](05-embed.md#the-tag) says.
- Their tag holds no copy of the roadmap, no `#roadmapper-wait` and no `<noscript>`. So the tag reads only `roadmap.json`.
:::

## Upload again

::: basics
After a change to the roadmap file, export again, and upload `roadmap.json` and `roadmap.html`. After a change to Roadmapper, export again, and upload all three files and the folder `fonts/`. A stranger sees the new roadmap on the next visit.

::: details internals
After each change in this table, export again, then upload the files that the table names.

| After a change to | Upload |
|---|---|
| The roadmap file | `roadmap.json` and `roadmap.html` |
| Roadmapper | All three files and the folder `fonts/` |

The browser asks the site each time whether `roadmap.json` has changed. So a stranger sees the new roadmap on the next visit.

::: internals
- On a site, the lib draws `roadmap.json`, not the copy in `roadmap.html`. Anyone can still read that copy in the source of the page. So a new `roadmap.json` goes up with a new `roadmap.html`.
- `roadmapper.js` stays the same from one export to the next, as `src/lib/export-script.ts` says. It changes only when Roadmapper changes.
- [The tag](05-embed.md#internals/the-tag) says how the tag reads `roadmap.json` again on each visit.
:::

## The page of the export

::: basics
The page fills the whole window and works like the app. Its popup holds the parts 'Key' and 'View'.

The title of the page is the `title` of the roadmap followed by ` · roadmap`, such as 'Plant care app · roadmap'.

::: details internals
- The page fills the whole window and works like the app. Each visit opens it the way the app opens the first time, as [What it remembers](03-use-the-app.md#internals/what-it-remembers) says.
- The popup holds the parts 'Key' and 'View'.
- The title of the page is the `title` of the roadmap followed by ` · roadmap`, such as 'Plant care app · roadmap'.
- The `about` of the roadmap is the `<meta name="description">` of the page.
- Until the lib runs, the page shows 'Loading the roadmap…'.
- When the lib does not run, the page shows 'The roadmap could not load: roadmapper.js did not run.' It cannot show this when the Content-Security-Policy of the site forbids inline scripts.
- With JavaScript off, the page shows 'This roadmap needs JavaScript.'

::: internals
`exportFiles()` writes `roadmap.html` with these parts:

| Part | What it does |
|---|---|
| `<title>` | It holds the title of the page before the lib runs. Then the lib sets the title on each draw, as [The tag](05-embed.md#internals/the-tag) says. |
| `<noscript>` in the head | It holds a style that hides `#roadmapper-wait` when JavaScript is off. |
| `<script src="roadmapper.js" defer>` | It loads the lib once the page is read. Its `onerror` writes the error text into `#roadmapper-wait`. Its `onload` does the same when the lib ran but `roadmapper-view` is still not defined. |
| `<roadmapper-view page src="roadmap.json">` | It is the tag of the lib, as the whole page. It holds the copy of the roadmap, `#roadmapper-wait` and a `<noscript>`. |
| `<p id="roadmapper-wait">` | It shows 'Loading the roadmap…' until the lib makes the view. |
| `<noscript>` in the tag | It shows 'This roadmap needs JavaScript.' |

- `esc()` in `src/cli/export.ts` writes `&`, `<`, `>` and `"` of the `title` and the `about` as `&amp;`, `&lt;`, `&gt;` and `&quot;`.
- `onerror` and `onload` are inline scripts. So a Content-Security-Policy that forbids inline scripts stops the error text.
- The lib of the export holds no icon set. So the tag reads `roadmap.json` before it makes the view, and the steps show their icons from the first draw.
:::

## Private items

::: basics
Without `--private`, the export leaves out each private item, and leaves no gap where it was. [format.md, section "Private items"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md#private-items) says what the export leaves out, and what the words of a shown item must not name.

A shown step that waits for private work that is not done shows as blocked. In 'Plant care app', 'Photo ID' shows as blocked, because 'Plant data deal', right before it, is private and not done.

::: details internals
Without `--private`, the private items stay on this computer. [format.md, section "Private items"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md#private-items) says what the export leaves out, and what the words of a shown item must not name. The export also follows these rules:

- It leaves no gap, lock or count where a private item was.
- It removes each group or branch that it leaves empty.
- When a branching keeps only one branch, and that branch comes back, the export puts its steps in place of the branching.
- The steps get new ids, `s1`, `s2` and so on, so that no id names a step that the export left out.
- No step keeps its `start`, `end` or `deadline`, so that a stranger cannot tell what is late.

A shown step that is neither done nor canceled gets `"waitsForPrivate": true` in either of these cases:

- Its `waitsFor` names a private step that is neither done nor canceled.
- It has not started, and each step right before it on its branch that is not done is private. A canceled step does not count: the steps right before the canceled step count in its place.

The page draws each such step as blocked. In 'Plant care app', the step 'Photo ID' gets `"waitsForPrivate": true`. It has not started, and 'Plant data deal', right before it, is private and not done.

::: internals
`publicRoadmap()` works in this order:

1. `look()` walks each step. It notes whether the cut takes the step, and which steps come right before it on its line. The cut takes each step that is private, or in a private branch, group or branching.
2. `blockedByCut()` finds each shown step that gets `"waitsForPrivate": true`.
3. `branch()` and `items()` drop each private item. Then they drop each group, branching and branch that they leave empty.
4. Each shown step gets its new id, in reading order. Its `waitsFor` keeps the new ids of the shown steps that it names. A `waitsFor` that is left empty goes.
5. `parseRoadmap()` in `src/roadmap/check.ts` checks the result.

- When no top-level branch is left, `publicRoadmap()` throws the `RoadmapError` `Nothing public`.
- A shown step keeps only `id`, `name`, `state`, `why`, `doneWhen`, `icon`, `milestone`, `links`, `waitsFor` and `waitsForPrivate`. A key that the file check does not know never goes into the export.
- A branch keeps only `name`, `ends`, `holds` and `items`. A group or a branching keeps only `split`, `name` and `branching`. The roadmap keeps only `title`, `about` and `branches`.
- A split is a branching when it has `"branching": true`, or when one of its branches ends. In the export, each branching has `"branching": true`, also when the branch that ended is cut.
- The export puts the steps of a branching in its place only when the branching had two or more branches before the cut.
- A step has not started when its `state` is `todo` or `tbd`, or when it has no `state`.
- `src/view/plan.ts` draws as blocked each step with `"waitsForPrivate": true` that is neither done nor canceled.
:::

## Keep the private items

To export the whole roadmap for those who may read all of it, add `--private` to both commands:

```sh
npx roadmapper export --private
npx roadmapper preview --private
```

::: basics
The export then holds the whole roadmap. Each private item has its 'Private' tag, as in the app.

::: details internals
The export then holds the whole roadmap, as the roadmap file has it. With no folder named, it writes into `dist/export-private/`, so that `dist/export/` never holds a private item. Each private item has its 'Private' tag, as in the app.

::: internals
- `--private` gives `exportFiles()` the option `private`. Then `roadmap.json` holds the data of the roadmap file as it is, plus the key `icons`.
- `run()` takes the folder from `exportPrivate` of its setup. `src/cli/bin.ts` and `scripts/roadmapper.mjs` set it to `dist/export-private/`.
- `facts()` in `src/view/facts.ts` adds the tag 'Private' to the row of facts of a private item, in the tip and the side bar.
:::
