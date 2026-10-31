# The Claude Code skill

This doc covers the `roadmapper` skill: what it does, how to install it in your project, what to ask Claude, and how to update it.

## What it does

The `roadmapper` skill tells Claude how to write and keep a roadmap file. With it, Claude writes the plan as a row of main steps in priority order. A step comes after the steps that it waits for, and the other steps follow by priority. Steps go side by side only when they have the same priority and two people can work on them at once.

Claude Code loads the skill for each request that makes, changes or reviews a roadmap file. A change adds, moves, splits or removes steps, or marks steps started, done or canceled.

The skill has two files:

- [SKILL.md](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/SKILL.md) says when to put a step after another step, and when to use a group or a branching. It says which steps get a `why` and a `doneWhen`, and which steps get the state `"tbd"`. It also gives the checks that Claude runs before it answers you.
- [format.md](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md) is the roadmap file format: every key, value, state and error.

## Install it in your project

Run this command in your project's folder. It puts the skill into your project's `.claude/skills/roadmapper/`.

```sh
npx skills add https://github.com/true-byte/roadmapper --skill roadmapper -a claude-code --copy
```

| Part | What it does |
|---|---|
| `npx skills add https://github.com/true-byte/roadmapper` | Runs [skills](https://github.com/vercel-labs/skills), a tool that installs a skill from a GitHub repo. |
| `--skill roadmapper` | Picks the `roadmapper` skill in that repo. |
| `-a claude-code` | Installs the skill for Claude Code. |
| `--copy` | Writes the files themselves, not links to them, so that you can commit them in your project. |

The command also writes `skills-lock.json` in your project's folder, which says where the skill comes from. Commit it with the skill: `npx skills update` reads it to find the skill.

Install Roadmapper in your project too, as [install.md](install.md) says. Claude needs Roadmapper, because Claude checks the roadmap file with `npx roadmapper validate` before it answers you.

## What to ask Claude

The first request makes a new roadmap file, so try it in a project that has no `roadmap.json`. The other requests change the sample roadmap file, 'Plant care app'. To try them, copy it into your project as `roadmap.json`, as step 2 of [install.md, section "Install in your project"](install.md#install-in-your-project) says.

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

## Update it

Run this command in your project's folder:

```sh
npx skills update roadmapper
```
