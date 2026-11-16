# Intro

## What it is

::: basics
Roadmapper draws a roadmap as a tree of steps, in marks, icons and short names. It is for a person who must see the whole plan, but does not run its tasks.

Roadmapper plans any goal that takes steps, not only software. The roadmap is kept in one JSON file, the roadmap file. You edit that file, or Claude does.

To show the roadmap to strangers, the HTML export puts it on a page of a site.

::: details internals
| Question | Answer |
|---|---|
| What problem does it solve? | Roadmap tools are task planners, such as kanban boards. Most of them are made for software development, and for a project manager. In them, a stakeholder cannot see the whole plan. |
| Who is it for? | The stakeholder: a person who must see the plan, but does not run its tasks. |
| What does it do? | It draws a roadmap as a tree, in marks, icons and short names. The whole name of a step shows in its tip, and its full text only in the side bar. |
| What can it plan? | Any goal that takes steps and needs its progress tracked, not only software. |
| How is a roadmap shared? | The HTML export puts it on a page of a site. There, a stranger zooms in as far as they need to understand the plan. The HTML export for strangers leaves out each private step, split and branch. |
| Where is a roadmap kept? | In one JSON file, the roadmap file. A person edits the file, or an AI model such as Claude does. |

::: internals
| Part | Code |
|---|---|
| The tree | `mountRoadmap()` in `src/view/view.ts` puts one view of the roadmap into a page. It gets the roadmap as text, and does not know where the text comes from. `drawPart()` in `src/view/draw.ts` draws each step of the plan. |
| The marks | `drawMark()` in `src/view/mark.ts` draws the mark of a state, on the plan and in the key. |
| The icons | A theme names its icon set as `--icon-set` in its `theme.css`. The default theme names `tabler`, the Tabler Icons of `src/icons/tabler.ts`. |
| The tip | `hoverPart()` in `src/view/hover.ts` shows the tip of a step, a group or a branch on a hover. |
| The side bar | `sidePart()` in `src/view/side.ts` shows the side bar of a step, a group or a branch on a click. A click never zooms. |
| The HTML export | `exportFiles()` in `src/cli/export.ts` makes the page and the roadmap file of the export. For strangers, it first cuts each private item out with `publicRoadmap()` in `src/roadmap/public.ts`. `run()` in `src/cli/cli.ts` writes them next to the lib `roadmapper.js` and the folder `fonts/`. The view draws all that it is given. |
| The roadmap file | `src/roadmap/types.ts` holds the types of the roadmap file. `checkRoadmap()` in `src/roadmap/check.ts` gives each error of its text, with its line. |
:::

## What it needs

::: basics
Roadmapper needs Node 22.12 or later, with the npm that comes with it. React is needed only for the React component.

::: details internals
| Tool | Version | Needed for |
|---|---|---|
| Node | 22.12 or later | The clone and your project |
| npm | The version that comes with Node | The clone and your project |
| React | The version that [In a React app](05-embed.md#in-a-react-app) gives | Only the React component of the lib |

The `engines` key in Roadmapper's `package.json` gives the same Node version.

::: internals
The workflow `.github/workflows/test.yml` runs `npm test` on each Node version that its `matrix` lists. Its check 'All tests' passes only when each Node version passes.

The key `peerDependencies` of `package.json` names React `>=18`, and `peerDependenciesMeta` marks React optional. `vite.lib.config.ts` keeps `react`, `react/jsx-runtime` and `react-dom` out of the lib. So `dist/lib/react.js` uses the React of your app.
:::

## Install in your project

::: basics
Run these commands in your project's folder. The first command installs Roadmapper. The second command copies the sample roadmap file, 'Plant care app', to `roadmap.json`.

```sh
npm install roadmapper
cp node_modules/roadmapper/roadmap/sample.roadmap.json roadmap.json
```

Commit `roadmap.json` with your project.

::: details internals
Follow these steps in your project's folder.

1. Install the package. This adds Roadmapper to your project's `package.json`.

   ```sh
   npm install roadmapper
   ```

2. Keep the roadmap file in your project's folder as `roadmap.json` or `roadmap/roadmap.json`, and commit it with your project. Roadmapper writes to the file only when you click 'Save' on the page. To start from the sample roadmap file, 'Plant care app', copy it:

   ```sh
   cp node_modules/roadmapper/roadmap/sample.roadmap.json roadmap.json
   ```

3. Check the install. The command prints `roadmap.json: no errors`.

   ```sh
   npx roadmapper validate
   ```

::: internals
The key `bin` of `package.json` names the command `roadmapper`, which runs `dist/cli/roadmapper.js`.

`projectFiles()` in `src/cli/cli.ts` gives the two paths of step 2, in the order in which a command looks for them.

Only the dev server of `npx roadmapper dev` or `npm run dev` writes the roadmap file. It takes the roadmap that 'Save' sends to the address `/save`, with `saveRequest()` in `src/cli/save.ts`. It takes a roadmap only from a page of its own host, so another site in the browser cannot send one. It refuses a roadmap of more than 16 MB.

`savePlan()` in `src/cli/save.ts` writes the roadmap into the file only when `checkRoadmap()` finds no error in it. The file gets the JSON with an indent of two spaces, and a line break at its end. [Edit on the page](03-use-the-app.md#edit-on-the-page) says what 'Save' shows on the page.

`tests/roadmap/check.test.ts` checks that the sample roadmap file has no error.

`run()` in `src/cli/cli.ts` runs `validate`. It checks the text of the file with `checkRoadmap()`. The path in `roadmap.json: no errors` is the path of the file from the folder where you typed the command.
:::

## Update

::: basics
To get the latest release of Roadmapper, run this command in your project's folder:

::: details internals
Run this command in your project's folder. It installs the latest release of Roadmapper.
:::

```sh
npm install roadmapper@latest
```

::: internals
`@latest` names the npm tag `latest`. [CONTRIBUTING.md, section "Make a release"](https://github.com/true-byte/roadmapper/blob/master/CONTRIBUTING.md#make-a-release) says which release gets that tag.
:::

## What the package holds

::: basics
The package holds the commands, the lib, the sample roadmap file and these docs. It installs no other package into your project.

::: details internals
| Part | Where in the package |
|---|---|
| The commands of `npx roadmapper` | `dist/cli/` |
| The lib | `dist/lib/` |
| The sample roadmap file | `roadmap/sample.roadmap.json` |
| The docs, with the screenshots of the README | `docs/` |
| The README | `README.md` |
| The license of Roadmapper | `LICENSE` |
| The fonts Atkinson Hyperlegible and Chakra Petch, with their licenses, the SIL Open Font License 1.1 | `dist/lib/fonts/` |

The package installs no other package into your project.

::: internals
The key `files` of `package.json` names `dist/lib`, `dist/cli`, `roadmap/sample.roadmap.json` and `docs`. `npm publish` first runs the script `prepack`, which builds the lib and the commands with `node scripts/build.mjs lib cli`.

`vite.cli.config.ts` builds `src/cli/bin.ts` into `dist/cli/roadmapper.js`, with all that it needs inside it. So the package has no dependency. Then the build of the app page, `vite.config.ts`, writes `dist/cli/app.html` next to it: the app page with no roadmap in it.

`vite.lib.config.ts` builds the lib into `dist/lib/`, and `tsconfig.lib.json` writes its types into `dist/lib/types/`. `themeFonts()` in `src/themes/fonts.ts` writes the folder `fonts/` of the theme into `dist/lib/`.

In `scripts/build.mjs`, the step `module` of `lib` empties `dist/lib/`, and the step `commands` of `cli` empties `dist/cli/`. Each step that writes into that folder starts after it.

`tests/cli/bin.test.ts` packs the package with `npm pack`, and installs it into a new project in the system's temp folder. The test checks that the package holds the commands, the lib with its fonts, the README and the sample roadmap file. The package must hold neither the skill nor Roadmapper's own roadmap file. The `node_modules` of that project must then hold only `roadmapper`.
:::

## The docs

::: basics
| To do this | Read |
|---|---|
| Install Roadmapper | [Install in your project](#install-in-your-project) |
| Run a command | [Commands](02-commands.md) |
| Use the page that shows your roadmap | [Use the app](03-use-the-app.md) |
| Put your roadmap on a site | [The HTML file and the HTML export](04-export.md) |
| Show your roadmap in a page of your own project | [Embed a roadmap](05-embed.md) |
| Let Claude write and keep your roadmap file | [The Claude Code skill](06-skill.md) |
| Look up a key of the roadmap file | [The roadmap file format](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md) |

::: details internals
| Doc | What it covers |
|---|---|
| [Install](#what-it-needs) | What Roadmapper needs, how to install and update it in your project, and what the package holds. |
| [Commands](02-commands.md) | Each `npx roadmapper` command and each `npm run` script that draws, checks or exports a roadmap file, or packs Roadmapper. |
| [Use the app](03-use-the-app.md) | The app: the page that shows one roadmap file, and how to use it. |
| [The HTML file and the HTML export](04-export.md) | The HTML file for you, and the HTML export that puts a roadmap on a site for strangers. |
| [Embed a roadmap](05-embed.md) | The lib, which shows a roadmap in a box on a page of another project. |
| [The Claude Code skill](06-skill.md) | The skill that tells Claude how to write and keep a roadmap file. |
| [The roadmap file format](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md) | Every key, value, state and error of a roadmap file. It is in the folder of the skill, so that the skill works when a project installs that folder alone. |

::: internals
The roadmap file format is `.claude/skills/roadmapper/format.md` in the clone.

`docs/nerddocs.json` names the reading levels 'Basics', 'Details' and 'Internals', and `defaultLevel` opens each page at 'Basics'. The test `tests/docs.test.ts` runs `npx nerddocs check docs`, and fails unless the check prints `Problems: 0`.
:::
