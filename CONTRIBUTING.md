# Contributing

This doc covers how to work on Roadmapper itself. It says how to set up a clone, run the tests, add a theme, send a change and make a release. It also gives the rules for code and docs, and what each folder of the clone holds.

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
2. It builds the pages that the browser tests open into `dist/tests/`. They are the app page on `tests/fixtures/roadmap.json`, the plan page in `tests/pages/plan/`, the pages in `tests/pages/embed/`, and the export of `tests/fixtures/export.json`.
3. It runs every test in `tests/`. Each core of the computer runs one test at a time.

`scripts/build.mjs` runs the builds of steps 1 and 2. Each build starts once the builds that it needs have ended, so builds that need nothing of each other run at the same time.

The folders of `tests/` are the folders of `src/`, and `tests/scripts/` tests the scripts in `scripts/`. Each test file is named after the source file that it tests: `tests/view/toolbar.spec.ts` tests `src/view/toolbar.ts`. The end of the file name says what kind of tests the file holds:

- A `.test.ts` file runs the code in Node, and opens no page. Each of its tests takes milliseconds, unless it starts a process.
- A `.spec.ts` file opens the built pages in Chromium, from disk.

A test that can run in Node goes in a `.test.ts` file. A test opens a page only for what needs one: the pointer, the keys, touch, the focus, a scroll, the CSS, or a reload. A browser test opens its page once, and checks each thing on it as a `test.step()`. A test name says what the code does, in 12 words or fewer.

| Folder | What it holds |
|---|---|
| `tests/support/` | The helpers of the browser tests, the plans that the tests draw, and the Vite plugins of the test pages. The plan page holds only the icons that the plans in `tests/support/plans.ts` name, so that it opens fast. A test that needs another icon names it in a plan there. |
| `tests/fixtures/` | The roadmap files that `npm test` builds pages from: `roadmap.json`, a copy of a real roadmap, and `export.json`, a made-up roadmap with private items and a `</script>` in a name. |
| `tests/pages/` | The test pages: `plan/`, which draws the plan that a test gives, and `embed/`, two made-up pages of another project. One page in `embed/` is a React app with `<Roadmap>`. The other page has no bundler and loads `dist/lib/roadmapper.js`. |

`tests/cli/bin.test.ts` packs Roadmapper, and installs the package into a new project in the system's temp folder. It runs `npx roadmapper` there, then deletes that project.

To run only the tests that open no page, run this command:

```sh
npx playwright test --project=plain
```

To run one test file on the pages that were built last, name the file:

```sh
npx playwright test tests/view/toolbar.spec.ts
```

`playwright.config.ts` runs the browser tests offline, so the pages draw in the fallback fonts. It runs them in the dark color scheme, at 1440 × 900, with reduced motion. A test that checks a move turns motion on.

A test waits for what the page does, such as an attribute, a text or an event that the page sets. It never waits for a set time. Where the page does not set the order of two events, the test passes in either order.

The tests read the attribute `data-moving` to wait until the plan is at rest, as [Wait for the plan to rest](#wait-for-the-plan-to-rest) says. A test that checks the view partway through a move or a timed effect runs it on Playwright's clock. A smooth scroll is the browser's own and runs in real time, so its test records each change of `data-moving`.

To find a test that passes at one speed and fails at another, run `npm run test:push`. It builds the code, then runs every test in three rounds:

| Round | What runs |
|---|---|
| 1 | 4 tests at once, on 4 CPUs of the computer |
| 2 | 4 tests at once, with each page 4 times slower |
| 3 | 8 tests at once, on 4 CPUs of the computer |

`taskset` puts the tests on 4 CPUs, and runs only on Linux. On another system, rounds 1 and 3 run on all the CPUs. When a round fails, the check stops. The output names each test that failed, and gives the command that runs the round again.

To run one test file as a round runs it, on the pages that were built last, run the line of that round below. The lines are for rounds 1, 2 and 3, in that order. `<cpus>` is the list of 4 CPUs that the output of the check gives.

```sh
taskset -c <cpus> npx playwright test --workers=4 tests/<folder>/<file>
SLOW_CPU=4 npx playwright test --workers=4 tests/<folder>/<file>
taskset -c <cpus> npx playwright test --workers=8 tests/<folder>/<file>
```

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
3. Write each color in the rule for `:root, .roadmap` as `light-dark()`: its light value, then its dark value, as in the default theme. Then 'Device', 'Light' and 'Dark' in the popup each draw the new theme.
4. Name the new folder in the `@import` of `src/themes/theme.css`. The app page, the lib and the export then draw in the new theme.

To add an icon set, put it into `src/icons/`, and add a loader by its name to `src/icons/sets.ts`. Keep the license of the icon set with its drawings, so that the license ships with them.

## Send a change

`main` holds the release with the highest version. The work for each release is on its release branch, which is named `release/` followed by the version, such as `release/1.0.0`. Each change is made on a branch of its own and goes into a release branch by a pull request. Only a finished release goes into `main`, by a pull request from its release branch, as [Finish a release](#finish-a-release) says.

1. If you have no write access to `true-byte/roadmapper`, fork it on GitHub. Then add your fork as the remote `fork` of your clone, where `<you>` is your GitHub user name:

   ```sh
   git remote add fork https://github.com/<you>/roadmapper
   ```

2. List the release branches of `true-byte/roadmapper`:

   ```sh
   git ls-remote origin 'refs/heads/release/*'
   ```

   Each line of the output ends with `refs/heads/release/` and a version, such as `refs/heads/release/1.0.0`. Most changes go into the release branch with the highest version. A fix to an older release goes into the release branch of its patch, as [Patch an older release](#patch-an-older-release) says.

   If no release branch fits the change, open an issue at https://github.com/true-byte/roadmapper/issues that says which release the change is for. Go on to step 3 when the command lists the release branch.

3. From that release branch, make a branch for one change. `<version>` is the version of that release branch, and `<branch>` is the name of the new branch. Name a fix `fix/<version>-` followed by a short name, such as `fix/1.0.0-npm-audit`. Name any other change `feature/<version>-` followed by a short name, such as `feature/1.0.0-links`. A `fix/` branch only fixes a bug of a released version, or of a change that is already merged. It holds nothing else.

   ```sh
   git fetch origin
   git switch -c <branch> origin/release/<version>
   ```

4. Install the packages and the Chromium that the release branch pins:

   ```sh
   npm install
   npx playwright install chromium
   ```

   On Linux, run this command in place of the last command, as [Set up a clone](#set-up-a-clone) says:

   ```sh
   npx playwright install --with-deps chromium
   ```

5. Make the change, with its tests and docs. Follow [Code rules](#code-rules) and [Write docs](#write-docs).
6. Run the tests with this command, which also checks the types and builds the code:

   ```sh
   npm test
   ```

7. When every test passes, push the branch to your fork:

   ```sh
   git push -u fork <branch>
   ```

   If you have write access to `true-byte/roadmapper`, run this command in its place:

   ```sh
   git push -u origin <branch>
   ```

8. Open `https://github.com/true-byte/roadmapper/compare/release/<version>...<you>:<branch>?expand=1`, and click 'Create pull request'. The page opens with `release/<version>` as the base branch. If you pushed the branch to `origin`, put `true-byte` in place of `<you>`.

A person with write access to `true-byte/roadmapper` reviews each pull request and decides whether to merge it into its release branch.

## Make a release

These steps need the admin role of `true-byte/roadmapper`. The rules of the repo let only an admin delete a release branch and make a tag whose name starts with `v`.

Each release has a tag. The name of the tag is `v` followed by the `version` in `package.json`, such as `v1.0.0-beta`. The tag keeps the commits of the release after its release branch is deleted.

In [Start a release](#start-a-release) and [Finish a release](#finish-a-release), `<version>` is the version of the release, such as `1.0.0`. A prerelease follows the same steps. For a prerelease, `<version>` is the version of the prerelease, such as `1.0.0-beta`.

### Start a release

When the work on a release starts, make its release branch from `main`:

```sh
git switch main
git pull origin main
git switch -c release/<version>
git push -u origin release/<version>
```

### Finish a release

1. Set the version in `package.json` and `package-lock.json`, on the branch `feature/<version>-version`:

   ```sh
   git fetch origin
   git switch -c feature/<version>-version origin/release/<version>
   npm version <version> --no-git-tag-version
   git add package.json package-lock.json
   git commit -m "Set the version to <version>"
   git push -u origin feature/<version>-version
   ```

   Open `https://github.com/true-byte/roadmapper/compare/release/<version>...feature/<version>-version?expand=1`, and click 'Create pull request'. Merge the pull request when the check 'All tests' passes.

2. Open `https://github.com/true-byte/roadmapper/compare/main...release/<version>?expand=1`, and click 'Create pull request'. When the check 'All tests' passes, merge the pull request with 'Create a merge commit', so that `main` keeps the commits of the release.
3. Tag `main`, and push the tag:

   ```sh
   git switch main
   git pull origin main
   git tag -a v<version> -m v<version>
   git push origin v<version>
   ```

4. Move each open pull request into `release/<version>` to the release branch of the next version. GitHub closes each pull request whose base branch is deleted. If the next version has no release branch yet, make it first, as [Start a release](#start-a-release) says. To move a pull request, open it, click 'Edit title', pick the new branch in the base branch menu, and click 'Change base'.
5. Delete the release branch:

   ```sh
   git push origin --delete release/<version>
   git branch -d release/<version>
   ```

### Patch an older release

A patch fixes a release with a lower version than the release that `main` holds. For example, `1.1.1` fixes `1.1.0` while `main` holds `2.0.0`. In these steps, `<release>` is the version to fix, such as `1.1.0`, and `<patch>` is the version of the patch, such as `1.1.1`.

1. Make the release branch of the patch from the tag of the release to fix:

   ```sh
   git fetch --tags origin
   git switch -c release/<patch> v<release>
   git push -u origin release/<patch>
   ```

   A plain `git fetch` gets no tag of a past patch, because the commits of a past patch are on no branch. `--tags` gets every tag, so `<release>` can be a past patch.

2. Send each pull request of the patch into `release/<patch>`, as [Send a change](#send-a-change) says, with `<patch>` as `<version>`.
3. When the patch is done, set its version, as step 1 of [Finish a release](#finish-a-release) says, with `<patch>` as `<version>`. Then tag the release branch, and push the tag:

   ```sh
   git fetch origin
   git switch release/<patch>
   git pull origin release/<patch>
   git tag -a v<patch> -m v<patch>
   git push origin v<patch>
   ```

4. If pull requests into `release/<patch>` are still open, make the release branch of the next patch from the tag `v<patch>`, as step 1 says. For example, make `release/1.1.2` from `v1.1.1`. Then move each of those pull requests to it, as step 4 of [Finish a release](#finish-a-release) says.
5. Delete the release branch of the patch:

   ```sh
   git switch main
   git push origin --delete release/<patch>
   git branch -D release/<patch>
   ```

   The branch never merges into `main`, so `git branch -d` refuses to delete it. `-D` deletes it, and the tag keeps its commits.

6. If the release branch with the highest version needs the fix too, copy the fix into a new branch from it. `<newest>` is the highest version that step 2 of [Send a change](#send-a-change) lists, such as `2.1.0`. If no listed version is higher than the release that `main` holds, start the next release first, as [Start a release](#start-a-release) says. `<branch>` is the name of the new branch, named as step 3 of [Send a change](#send-a-change) says.

   ```sh
   git fetch --tags origin
   git switch -c <branch> origin/release/<newest>
   git log --reverse --no-merges --oneline v<release>..v<patch>
   git cherry-pick <commit>
   ```

   `git log` lists the commits of the patch, oldest first. Each line of its output starts with the hash of a commit. Run `git cherry-pick` for each of those commits, where `<commit>` is its hash. Leave out the last commit, `Set the version to <patch>`, which is not part of the fix.

   Then send the branch as steps 4 and 6 to 8 of [Send a change](#send-a-change) say, with `<newest>` as `<version>`.

## Where each part is

| Folder | What it holds |
|---|---|
| `data/` | The roadmap files of the clone. |
| `.claude/skills/roadmapper/` | The `roadmapper` skill, with the roadmap file format. |
| `docs/` | The docs on using Roadmapper, and the screenshots of `README.md` in `docs/images/`. |
| `src/roadmap/` | The types of a roadmap file, the code that checks a roadmap file, and the code that gives each step its state. |
| `src/view/` | The view, `mountRoadmap()`, which draws the plan. |
| `src/themes/` | The themes, each in a folder of its own, and `theme.css`, which names the theme that is drawn. |
| `src/icons/` | The icon sets that a theme can name, and the code that loads them. |
| `src/app/` | The app page. |
| `src/lib/` | The lib: the tag `<roadmapper-view>` and the React component `Roadmap`. |
| `src/cli/` | The commands of `npx roadmapper`, and the HTML export. |
| `scripts/` | The scripts that `npm run` runs. |
| `tests/` | The tests, in the folders of `src/`, and the pages, plans and roadmap files that they use. |
| `dist/` | The files that the commands build, which Git ignores. |
| `.tmp/` | The files of a check, such as screenshots, which Git ignores. |

The code calls a step a node.

The config files at the root of the clone set how Vite serves the app page and builds the code. They also set how TypeScript checks the types and writes the types of the lib, and how Playwright runs the tests.
