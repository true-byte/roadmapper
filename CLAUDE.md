# Roadmapper: rules for Claude

This doc covers the rules for a Claude session that works on Roadmapper itself, and nothing else.

| What | Where |
|---|---|
| What Roadmapper is for, and the list of the docs on using it | [docs/README.md](docs/README.md) |
| How to set up a clone, build, check and test the code, add a theme, send a change, make a release, and find each folder | [CONTRIBUTING.md](CONTRIBUTING.md) |
| The rules that every edit to a doc follows | [CONTRIBUTING.md, section "Write docs"](CONTRIBUTING.md#write-docs) |
| Every command that draws, checks or exports a roadmap file, or packs Roadmapper | [docs/commands.md](docs/commands.md) |
| The roadmap file format | [.claude/skills/roadmapper/format.md](.claude/skills/roadmapper/format.md) |
| How to keep a roadmap file | The `roadmapper` skill, [.claude/skills/roadmapper/SKILL.md](.claude/skills/roadmapper/SKILL.md) |
| Roadmapper's own roadmap file | `data/roadmap.json` |

## Scope

- No other project's content goes into this repo's roadmap file, docs, code or chat.
- Build no accounts, no tenants and no list of roadmaps.
- Add no feature that `data/roadmap.json` does not plan.

## Code

SaaS must fit in later with no full rework. For the code, this means:

- A roadmap always comes in as data. The code that checks, draws and edits it never knows its source, and never reads the roadmap from a global.
- All state of a view lives in that view (`mountRoadmap()` in `src/view/`). Only `src/app/main.ts` knows this instance: which roadmap file the page shows, and the name it keeps its state under.

Themes must fit in with no rework. A user only picks a theme, and users never make a theme. For the code, this means:

- Every color, font and style lives in the theme, as CSS variables. The code that draws never holds a color or a font.
- The icons come from an icon set that the theme names.
- A new theme is one new folder in `src/themes/`, which holds its `theme.css`. The one `@import` of `src/themes/theme.css` names the theme that is drawn, and no other file names it. [CONTRIBUTING.md, section "Add a theme"](CONTRIBUTING.md#add-a-theme) gives the steps.

The stack is Vite, plain TypeScript and SVG, with no UI framework. `src/lib/react.ts` only wraps the tag for a React app. When a change to the lib must favor one kind of page, it favors a React app. Any other page uses the tag.

## Roadmapper's roadmap file

Keep `data/roadmap.json` with the `roadmapper` skill. To check the file in this clone, run `validate` from the source:

```sh
npm run validate -- data/roadmap.json
```

This project adds these rules to the skill:

- No text of the roadmap file names a person or a role who acts. Write what is done, such as "A mock of the 'Links' part of the side bar is reviewed and approved."
- Each feature has the shape that the Icons feature has in `data/roadmap.json`: the step 'Icons design', then the group 'Icons build'. That group has two tracks: 'Code', with the step 'Icons code', and 'Tests', with the step 'Icons tests'.
- The 'Code' track of a feature also holds the feature's docs, where it has any.
- Features that do not need each other go side by side in a branching.
- A step can take many sessions.
- Each version is a top-level branch. Its name is `v` followed by the version, such as 'v1.0.0'. Its first step waits for the release of the version before it, with `waitsFor`.
- A build step writes the keys that its feature adds to the roadmap file format into `format.md`, when the step is done.
- `format.md` never gets a key before the feature that draws it.

## The tree shape

- No top-level branch is the main one: the plan has no trunk.
- Draw no line between two top-level branches, not even for `waitsFor`.
- When the plan runs across, it reads like the tech tree of Civilization 7. When it runs down, it is the same plan, turned.
- The plan stays as clean as the skill tree of Jedi: Fallen Order.

## Check your work

1. Install the Playwright browser, as [CONTRIBUTING.md, section "Set up a clone"](CONTRIBUTING.md#set-up-a-clone) says.
2. Build the HTML file and take a screenshot of it:

   ```sh
   npm run build -- data/roadmap.json
   npx --no-install playwright screenshot --color-scheme=dark --viewport-size=1440,900 "file://$PWD/dist/app/index.html" .tmp/shot.png
   ```

3. Read `.tmp/shot.png`. Git ignores `.tmp/`.
