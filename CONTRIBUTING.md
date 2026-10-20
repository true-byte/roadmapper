# Contributing

This doc covers how to work on Roadmapper itself. It says how to set up a clone, run the tests and add a theme. It also gives the rules for code and docs, and where each part is.

## Set up a clone

Roadmapper needs the Node version that [docs/install.md, section "What it needs"](docs/install.md#what-it-needs) gives. Run these commands to clone Roadmapper and install what it needs:

```sh
git clone https://github.com/true-byte/roadmapper
cd roadmapper
npm install
npx playwright install chromium
```

`package.json` pins the version of Playwright, and `npx playwright install chromium` installs the Chromium of that version. On Linux, run this command in place of the last command. It also installs the system libraries that Chromium needs.

```sh
npx playwright install --with-deps chromium
```

[docs/commands.md](docs/commands.md) gives the commands that draw, check or export a roadmap file, or pack Roadmapper. [docs/commands.md, section "The roadmap files of the clone"](docs/commands.md#the-roadmap-files-of-the-clone) says which roadmap file `npm run dev` draws, and how to draw another one.

`npm run dev` shows each change to `src/`. A saved `.ts` file reloads the page. A saved `.css` file changes the styles on the page with no reload. `npx roadmapper dev` serves the app page of the installed package, so it does not show a change to `src/`.

## Build and check the code

| Command | What it does |
|---|---|
| `npm run check` | Checks the types of the code. |
| `npm run build:lib` | Checks the types, builds the lib into `dist/lib/`, and writes its types into `dist/lib/types/`. |
| `npm run build:cli` | Builds the commands into `dist/cli/roadmapper.js`, and the app page with no roadmap in it into `dist/cli/app.html`. |
| `npm run build:tests` | Builds the pages that the tests open, as step 2 of [Run the tests](#run-the-tests) says. It needs the files that `npm run build:lib` and `npm run build:cli` build. |
| `npm run prepack` | Builds the lib, the commands and the app page of the package. npm runs it before each `npm pack`. |

## Run the tests

```sh
npm test
```

`npm test` runs three steps:

1. It builds the lib, the commands and the app page of the package.
2. It builds the pages that the tests open into `dist/tests/`. They are the app page on `tests/roadmapper.json`, the test page in `tests/page/`, the pages in `tests/embed/`, and the export of `tests/export/plan.json`.
3. It runs the browser tests in `tests/` on those pages. Each core of the computer runs one test at a time. Chromium opens each page from disk.

To run one test file on the pages that were built last, name the file:

```sh
npx playwright test tests/cli.spec.ts
```

| Part | What it is |
|---|---|
| `tests/cli.spec.ts` | It packs Roadmapper, and installs the package into a new project in the system's temp folder. It runs `npx roadmapper` there, then deletes that project. Through Playwright's routes, it checks what `dev` and `preview` would serve, so it starts no server. |
| `tests/embed/` | It holds two made-up pages of another project: a React app with `<Roadmap>`, and a page with no bundler that loads `dist/lib/roadmapper.js`. Each page has CSS of its own, and that CSS must not change the box of the lib. |
| `tests/export/` | It holds a made-up roadmap with a `</script>` in a name and with private items. The tests open its export from a made-up page of a site, which the tests serve themselves. |
| `tests/page/` | It holds the test page, which has only the icons that the plans in `tests/plans.ts` name, so that it opens fast. A test that needs another icon names it in a plan there. |
| `playwright.config.ts` | It runs the tests offline, so the pages draw in the fallback fonts. It runs them in the dark color scheme, at 1440 × 900, with reduced motion. A test that checks a move turns motion on. |

The tests read the attribute `data-moving` to wait until the plan is at rest, as [Wait for the plan to rest](#wait-for-the-plan-to-rest) says. They run each timed effect and each move on Playwright's clock.

## Hold the page still

To hold a page still for a check, end its address with `#z=`, `#u=`, `#t=` or `#w=` and a number. This works on the app page and on the page of an HTML export.

| Address ends with | What the page shows |
|---|---|
| `#z=1.5` | The plan halfway from 'Tracks' to 'Every step'. |
| `#u=0.5` | The plan halfway from marks to icons. |
| `#t=0.5` | The plan halfway from running across to running down. |
| `#w=0.5` | The plan halfway from labels shown to labels hidden. |

Each load of a page that is held still shows the plan the same way. An address that ends this way does not change a box of the lib. The box never reads the address of the page that it is on.

## Wait for the plan to rest

While the plan moves, the element that `mountRoadmap()` draws in has the attribute `data-moving`. The attribute goes away when the plan is at rest. The plan moves while it does one of these:

- It goes to another level or layout.
- It switches between icons and marks.
- It shows or hides its labels.
- It scales or scrolls smoothly.

That element is `#app` on the app page. In `<roadmapper-view>`, it is the `.roadmap` element in the shadow root.

## Code rules

[CLAUDE.md](CLAUDE.md) holds the code rules, in its sections "Scope", "Code" and "The tree shape". They hold for every change, made by hand or by Claude. The section "Roadmapper's roadmap file" of CLAUDE.md holds the rules for `data/roadmap.json`, Roadmapper's own roadmap file.

## Write docs

These rules hold for `README.md`, every file in `docs/`, `CONTRIBUTING.md`, `CLAUDE.md` and the skill in `.claude/skills/roadmapper/`.

### Scope

- Each doc covers one subject. Its first line names it: "This doc covers …".
- One fact lives in one doc. Other docs link to it.
- A doc says what is. It names a missing thing only where the reader would fail without it, and then says what to do instead.

### Sentences

- One idea per sentence, in 25 words or fewer.
- Write whole sentences. Leave out no word that the reader must guess: write "The same id is also on line 41.", not "Also on line 41."
- Steps are commands: "Run", "Open", "Copy". Facts are in the present tense.
- Use plain words, for a reader whose first language may not be English. Use no metaphor and no word of your own: write "Claude puts the step after the step it needs", not "Claude fixes the false lines".
- Explain in terms the reader can see: what changes in the roadmap file, on the page, or in a command's output.
- Use no filler, such as "simply", "just", "easily", "note that" or "powerful".

### Words

- Give each thing one name, the name the page shows, and use it in every file: roadmap file, step, branch, group, branching, track, level, milestone. `format.md` defines the pieces of a roadmap file, and `view.md` defines the levels.
- Put a label that the page shows in single quotes: 'Main steps'. Put a command, key, path or value in backticks: `waitsFor`.
- Call Claude "Claude". Call the reader "you".

### Layout

- Write headings in sentence case.
- Use a table to look things up: three rows or more of one kind, with a header row. For fewer rows, write a list.
- Rows of one kind share one fixed format.
- Put a command in a sh code block, one command per line, so that it runs as written.

### Examples

- Take all examples in one doc from one plan.
- The docs take their examples from the sample roadmap file, 'Plant care app' (`data/sample.roadmap.json`), so that you can open it and find each step.
- The skill takes its examples from one plan that is not software: opening a bakery. A roadmap file plans any goal, and the skill must not read as if it were for software only.
- Use names that a person would write, never 'Step A' or 'foo'.
- Write a request to Claude the way a person types it. Say what Claude does as what changes in the roadmap file.

## Add a theme

A theme is one file, `theme.css`, in a folder of its own in `src/themes/`. It sets every color and font of the view as CSS variables.

1. Copy `src/themes/default/` to `src/themes/<name>/`, where `<name>` is the name of the new theme.
2. Set each variable in the new `theme.css`. `--fonts` is the address of the style sheet of the web fonts. `--icon-set` is the name of an icon set in `src/icons/sets.ts`.
3. Set the light colors under `@media (prefers-color-scheme: light)`, as the default theme does.
4. Name the new folder in the `@import` of `src/themes/theme.css`. The app page, the lib and the export then draw in the new theme.

To add an icon set, put it into `src/icons/`, and add a loader by its name to `src/icons/sets.ts`. Keep the license of the icon set with its drawings, so that the license ships with them.

## Where each part is

| Folder | What it holds |
|---|---|
| `data/` | The roadmap files of the clone. [docs/commands.md, section "The roadmap files of the clone"](docs/commands.md#the-roadmap-files-of-the-clone) says what each one is. |
| `.claude/skills/roadmapper/` | The skill: `SKILL.md`, and the roadmap file format in `format.md`. |
| `docs/` | The docs on using Roadmapper, and the screenshots of the README in `docs/images/`. |
| `src/roadmap/` | The roadmap as data. It holds the types of the file and the states (`types.ts`), and the check of a file (`check.ts`). It holds the name and line of each error (`errors.ts`), and the state that the file gives each step (`states.ts`). It also holds the roadmap that a stranger sees (`public.ts`), which has no private item. The code calls a step a node. |
| `src/view/` | One roadmap view, `mountRoadmap()`, which is the whole page or a box on another page. It gets the roadmap as text and keeps its own state. Each part of the view is a file of its own. The main parts are three files. `plan.ts` holds the plan as the view reads it. `layout.ts` gives the place of each piece at each level and layout. `draw.ts` draws the plan. Other parts are the zoom control (`toolbar.ts`), the list of branches (`branches.ts`), the side bar (`side.ts`), the error list (`error-list.ts`) and the CSS (`view.css`). `fonts.ts` gives the width of each name in the theme's fonts. `context.ts` holds the context that `mountRoadmap()` makes for each view, with its state, and gives to each part. |
| `src/themes/` | The themes, one folder each, and `theme.css`, which names the theme that is drawn. |
| `src/icons/` | How an icon set is read, and the icon sets that a theme can name. Each icon set loads only when it is needed. Tabler Icons is here, with its MIT license. |
| `src/app/` | The app page (`index.html` and `main.ts`). It is the one part that knows this instance: which roadmap file it shows, and the name it keeps its state under. It also holds the slot in the built page that `build` and `dev` fill (`slot.ts`). `main.ts` redraws the plan on each save of the file. |
| `src/lib/` | The lib: the tag `<roadmapper-view>` (`element.ts`) and the React component (`react.ts`). It holds the lib for a page with a bundler (`index.ts`), and the lib as one plain script (`script.ts`). It also holds the export's lib (`export-script.ts`), which holds no icon set. |
| `src/cli/` | The commands `dev`, `build`, `validate`, `export` and `preview` (`cli.ts`), the HTML export (`export.ts`), and what `npx roadmapper` runs (`bin.ts`). `npx roadmapper` runs the commands from the package. |
| `scripts/` | The scripts that `npm run` runs. `npm run dev` runs `dev.mjs`, and `npm run package` runs `pack.mjs`. `npm run validate`, `build`, `export` and `export:preview` run `roadmapper.mjs`, which runs the commands of `src/cli/` from the source. With no file named, `dev.mjs` and `roadmapper.mjs` read the file that [docs/commands.md, section "The roadmap files of the clone"](docs/commands.md#the-roadmap-files-of-the-clone) names. |
| `tests/` | The browser tests, the plans they draw in `plans.ts`, what they share in `helpers.ts`, and the folders that [Run the tests](#run-the-tests) names. `roadmapper.json` is an old copy of Roadmapper's roadmap file, which the tests' app page draws. |
| `dist/` | All that the commands build. Git ignores it. |
| `.tmp/` | The files of a check, such as screenshots. Git ignores it. |

| Config file | What it sets |
|---|---|
| `vite.config.ts` | How `npm run dev` serves the app page on a roadmap file. It also sets how `vite build` builds `dist/cli/app.html`, the app page with no roadmap in it. |
| `vite.lib.config.ts`, `tsconfig.lib.json` | How the lib is built into `dist/lib/`, and its types into `dist/lib/types/`. |
| `vite.cli.config.ts` | How the commands are built into `dist/cli/roadmapper.js`, with all they need inside. |
| `playwright.config.ts` | How the tests run. |
| `tsconfig.json` | How the types of the code are checked. |
