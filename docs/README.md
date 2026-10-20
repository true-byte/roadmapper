# Roadmapper docs

This doc covers what Roadmapper is for, and lists the docs on using it.

## What it is

| Question | Answer |
|---|---|
| What problem does it solve? | Roadmap tools are task planners, such as kanban boards. Most of them are made for software development, and for a project manager. In them, a stakeholder cannot see the whole plan. |
| Who is it for? | The stakeholder: a person who must see the plan, but does not run its tasks. |
| What does it do? | It draws a roadmap as a tree, in marks, icons and short names. The full text of a step shows only in its tip and in the side bar. |
| What can it plan? | Any goal that takes steps and needs its progress tracked, not only software. |
| How is a roadmap shared? | The HTML export puts it on a page of a site. There, a stranger zooms in as far as they need to understand the plan. The HTML export for strangers leaves out each private step, split and branch. |
| Where is a roadmap kept? | In one JSON file, the roadmap file. A person edits the file, or an AI model such as Claude does. |

## The docs

| Doc | What it covers |
|---|---|
| [Install](install.md) | What Roadmapper needs, how to build its package, how to install and update it in your project, and what the package holds. |
| [Commands](commands.md) | Each `npx roadmapper` command and each `npm run` script that draws, checks or exports a roadmap file, or packs Roadmapper. |
| [Use the app](view.md) | The app: the page that shows one roadmap file, and how to use it. |
| [The HTML file and the HTML export](export.md) | The HTML file for you, and the HTML export that puts a roadmap on a site for strangers. |
| [Embed a roadmap](embed.md) | The lib, which shows a roadmap in a box on a page of another project. |
| [The Claude Code skill](skill.md) | The skill that tells Claude how to write and keep a roadmap file. |
| [The roadmap file format](https://github.com/true-byte/roadmapper/blob/main/.claude/skills/roadmapper/format.md) | Every key, value, state and error of a roadmap file. It is in the folder of the skill, so that the skill works when a project installs that folder alone. |
