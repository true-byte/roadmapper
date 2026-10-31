# Roadmapper

This doc covers what Roadmapper is, how to install and start it, and where the other docs are.

Roadmapper draws a roadmap as a tree, which the docs call the plan. The roadmap is kept in one JSON file, the roadmap file. At the level 'Main steps', anyone can read the plan, even a child in 3rd grade. The next levels, 'Tracks' and 'Every step', show more detail.

<picture>
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/true-byte/roadmapper/master/docs/images/roadmap-light.png">
  <img alt="The sample roadmap file, 'Plant care app', at the level 'Main steps'" src="https://raw.githubusercontent.com/true-byte/roadmapper/master/docs/images/roadmap.png">
</picture>

## Install

Run this command in your project's folder. [docs/install.md](docs/install.md) gives the Node version that Roadmapper needs, and each step in detail.

```sh
npm install roadmapper
```

## Quick start

Run these commands in your project's folder. The first command copies the sample roadmap file, 'Plant care app', to `roadmap.json`. The second command serves the app, which shows `roadmap.json`.

```sh
cp node_modules/roadmapper/data/sample.roadmap.json roadmap.json
npx roadmapper dev
```

Open the address that `npx roadmapper dev` prints. The page redraws the plan each time you save `roadmap.json`.

To show the roadmap in a React app, use the component `Roadmap`:

```jsx
import { Roadmap } from 'roadmapper/react';
import roadmap from './roadmap.json';

<Roadmap roadmap={roadmap} style={{ height: 720 }} />
```

[docs/embed.md](docs/embed.md) gives each prop of `Roadmap`, and the tag `<roadmapper-view>` for a page without React.

## Claude Code skill

The `roadmapper` skill tells Claude how to write and keep a roadmap file. With it, Claude writes the plan as a row of main steps in priority order. To install the skill, run this command in your project's folder:

```sh
npx skills add https://github.com/true-byte/roadmapper --skill roadmapper -a claude-code --copy
```

[docs/skill.md](docs/skill.md) says what to ask Claude, and how to update the skill.

## Docs

[docs/README.md](docs/README.md) says what Roadmapper is for, and lists each doc.

## Contributing

[CONTRIBUTING.md](https://github.com/true-byte/roadmapper/blob/master/CONTRIBUTING.md) says how to set up a clone, run the tests, add a theme, send a change and make a release. It also gives the rules for code and docs, and what each folder of the clone holds.

## License

Roadmapper is under the MIT License. [LICENSE](LICENSE) holds its text.
