# The Claude Code skill

## What it does

::: basics
The `roadmapper` skill tells Claude how to write and change a roadmap file. With it, Claude keeps the plan as a row of main steps in priority order. Claude Code uses the skill each time you ask Claude to make, change or review a roadmap file.

::: details internals
The `roadmapper` skill tells Claude how to write and keep a roadmap file. With it, Claude writes the plan as a row of main steps in priority order. A step comes after the steps that it waits for, and the other steps follow by priority. Steps go side by side only when they have the same priority and two people can work on them at once.

Claude Code loads the skill for each request that makes, changes or reviews a roadmap file. A change adds, moves, splits or removes steps, or marks steps started, done or canceled.

The skill has two files:

- [SKILL.md](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/SKILL.md) says when to put a step after another step, and when to use a group or a branching. It says which steps get a `why` and a `doneWhen`, and which steps get the state `"tbd"`. It also gives the checks that Claude runs before it answers you.
- [format.md](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md) is the roadmap file format: every key, value, state and error.

::: internals
The skill is the folder `.claude/skills/roadmapper/` of the Roadmapper repo. `SKILL.md` opens with a front matter of two keys: `name`, which is `roadmapper`, and `description`. The `description` lists the requests that the skill is for.

Every example of SKILL.md comes from one plan, the opening of a bakery. [format.md, section "Example"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md#example) gives that plan in full.

`PIECES`, in `src/roadmap/check.ts`, lists the keys that `validate` takes in each piece of a roadmap file. Any other key gives the error `Unknown key`. `NEEDS` lists the keys that each piece must have, and a missing one gives `Missing key`. format.md gives the same keys, and marks each key of `NEEDS` as "Needed".

A Claude session in a clone of Roadmapper keeps `roadmap/roadmap.json` with the skill of the clone. [CLAUDE.md, section "Roadmapper's roadmap file"](https://github.com/true-byte/roadmapper/blob/master/CLAUDE.md#roadmappers-roadmap-file) adds rules of its own to the skill. There, Claude checks the file with `npm run validate -- roadmap/roadmap.json`, which runs `validate` from the source.
:::

## Install it in your project

::: basics
Run this command in your project's folder. It puts the skill into your project.

::: details internals
Run this command in your project's folder. It puts the skill into your project's `.claude/skills/roadmapper/`.
:::

```sh
npx skills add https://github.com/true-byte/roadmapper --skill roadmapper -a claude-code --copy
```

::: basics
Install Roadmapper in your project too, as [Install in your project](01-intro.md#install-in-your-project) says. Claude uses it to check the roadmap file before it answers you.

::: details internals
| Part | What it does |
|---|---|
| `npx skills add https://github.com/true-byte/roadmapper` | Runs [skills](https://github.com/vercel-labs/skills), a tool that installs a skill from a GitHub repo. |
| `--skill roadmapper` | Picks the `roadmapper` skill in that repo. |
| `-a claude-code` | Installs the skill for Claude Code. |
| `--copy` | Writes the files themselves, not links to them, so that you can commit them in your project. |

The command also writes `skills-lock.json` in your project's folder, which says where the skill comes from. Commit it with the skill: `npx skills update` reads it to find the skill.

Install Roadmapper in your project too, as [Install in your project](01-intro.md#install-in-your-project) says. Claude needs Roadmapper, because Claude checks the roadmap file with `npx roadmapper validate` before it answers you.

::: internals
`npx skills add` takes the skill from the folder `.claude/skills/roadmapper/` of the repo on GitHub. The address names no branch, so the command takes the folder from `master`, the default branch of the repo.

`npm install roadmapper` puts no skill into a project. The `files` of `package.json` name the folders and files of the npm package, and `.claude/` is not one of them. The test 'the package holds what a project needs, and installs nothing else', in `tests/cli/bin.test.ts`, checks that the package holds no `.claude/`.

The entry of the skill in `skills-lock.json` holds its `source` on GitHub and its `skillPath`. It also holds the `installMode` `copy`, which `--copy` sets, and a `computedHash` of the skill folder. The `skills-lock.json` of the clone holds such an entry for the `nerddocs` skill.

[SKILL.md, section "Before you answer"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/SKILL.md#before-you-answer), step 5, tells Claude to run `npx roadmapper validate roadmap.json` itself. Claude fixes each error and runs it again, until it prints `roadmap.json: no errors`. `run()`, in `src/cli/cli.ts`, prints that line when `checkRoadmap()` of `src/roadmap/check.ts` finds no error.
:::

## What to ask Claude

::: basics
The first request below makes a new roadmap file, in a project that has no `roadmap.json`. To try the other requests, copy the sample roadmap file, 'Plant care app', into your project as `roadmap.json`. Step 2 of [Install in your project](01-intro.md#install-in-your-project) gives the command.

| You type | What changes in the roadmap file |
|---|---|
| "Make a roadmap for our plant care app." | Claude writes a new `roadmap.json`. |
| "We started the web invite." | Claude marks 'Web invite' as in progress. |
| "The supplier signed." | Claude marks 'Supplier signs' as done. |
| "We dropped the watch app." | Claude marks 'Watch app' as canceled. The step stays in the file. |
| "Review the roadmap." | Claude moves each step that is in the wrong place. |

Claude ends its answer with one or two sentences that say what changed on the page.

::: details internals
The first request makes a new roadmap file, so try it in a project that has no `roadmap.json`. The other requests change the sample roadmap file, 'Plant care app'. To try them, copy it into your project as `roadmap.json`, as step 2 of [Install in your project](01-intro.md#install-in-your-project) says.

| You type | What changes in the roadmap file |
|---|---|
| "Make a roadmap for our plant care app." | Claude writes a new `roadmap.json`. Each step comes after the steps that it waits for, as 'Plant data deal' comes after 'Supplier signs' in the sample roadmap file. The other steps follow in the order of priority that you give. Steps go side by side only when they have the same priority and two people can work on them at once, as the tracks 'Code' and 'Tests' of 'Sharing build' do. |
| "Add app store screenshots to V2. We take them once the beta bugs are fixed." | Claude adds the step 'App store screenshots' between the group 'Beta test' and 'Release V2'. Claude gives it the state `"tbd"`, because 'Fix top bugs', the last step before it, cannot start yet. On the page, its mark is a dashed ring. |
| "We started the web invite." | Claude sets `"state": "in-progress"` on 'Web invite'. |
| "The supplier signed." | Claude sets `"state": "done"` on 'Supplier signs'. 'Plant data deal' can then start. So Claude gives 'Photo ID', the step after it, a `doneWhen` in place of the state `"tbd"`. |
| "We dropped the watch app." | Claude sets `"state": "canceled"` on 'Watch app'. The step stays in the file, as 'Dark mode' does. |
| "Review the roadmap." | Where a step neither waits for the step before it nor comes after it by priority, Claude moves that step. Where branches side by side differ in priority, or would get in each other's way, Claude puts them in a row. |

- When Claude is not sure whether a step waits for another step, or which of two steps comes first, Claude asks you one short question before it saves.
- When a new step goes next to steps in the wrong order, Claude puts those steps in order too. The done steps stay where they are. Claude tells you which steps moved.
- Claude ends its answer with one or two sentences that say what changed on the page.

::: internals
For each request, Claude follows these sections of SKILL.md:

| You type | The sections of SKILL.md |
|---|---|
| "Make a roadmap for our plant care app." | [A line means "comes next"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/SKILL.md#a-line-means-comes-next) and [Decide each wait and the order](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/SKILL.md#decide-each-wait-and-the-order) |
| "Add app store screenshots to V2. We take them once the beta bugs are fixed." | [Make near steps exact and far steps "tbd"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/SKILL.md#make-near-steps-exact-and-far-steps-tbd) |
| "We started the web invite." | [The keys of a step](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/SKILL.md#the-keys-of-a-step), row `state` |
| "The supplier signed." | [The keys of a step](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/SKILL.md#the-keys-of-a-step), row `state`, and [Make near steps exact and far steps "tbd"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/SKILL.md#make-near-steps-exact-and-far-steps-tbd) |
| "We dropped the watch app." | [The keys of a step](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/SKILL.md#the-keys-of-a-step), row `state` |
| "Review the roadmap." | [Before you answer](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/SKILL.md#before-you-answer), step 1 |

The three rules of the list above come from these sections of SKILL.md, in order:

1. [Decide each wait and the order](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/SKILL.md#decide-each-wait-and-the-order)
2. [Add to a plan that has wrong lines](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/SKILL.md#add-to-a-plan-that-has-wrong-lines)
3. [When you are done](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/SKILL.md#when-you-are-done)

In `src/view/plan.ts`, a step gets the state `blocked` while a step of its `waitsFor` is neither done nor canceled. A step that is done or canceled itself keeps its state. A line never makes a step blocked. A step with no `state` gets `todo`. So the page draws 'Plant data deal' with an empty ring while 'Supplier signs' is in progress.

The rule `.node.tbd .ring`, in `src/view/view.css`, draws the dashed ring of a `"tbd"` step, with `stroke-dasharray: 3 3`.
:::

## Update it

::: basics
To update the skill, run this command in your project's folder:

::: details internals
Run this command in your project's folder:
:::

```sh
npx skills update roadmapper
```

::: internals
`npx skills update` takes the skill folder again from `master` on GitHub. So a change to `.claude/skills/roadmapper/` reaches a project at its next update after the change is in `master`. Only a finished release goes into `master`, as [CONTRIBUTING.md, section "Send a change"](https://github.com/true-byte/roadmapper/blob/master/CONTRIBUTING.md#send-a-change) says.
:::
