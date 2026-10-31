# Install

This doc covers what Roadmapper needs, how to install and update it in your project, and what the package holds.

## What it needs

| Tool | Version | Needed for |
|---|---|---|
| Node | 22.12 or later | The clone and your project |
| npm | The version that comes with Node | The clone and your project |
| React | The version that [embed.md](embed.md) gives | Only the React component of the lib |

The `engines` key in Roadmapper's `package.json` gives the same Node version.

## Install in your project

Follow these steps in your project's folder.

1. Install the package. This adds Roadmapper to your project's `package.json`.

   ```sh
   npm install roadmapper
   ```

2. Keep the roadmap file in your project's folder as `roadmap.json`, and commit it with your project. Roadmapper reads the file where it is, and never writes to it. To start from the sample roadmap file, 'Plant care app', copy it:

   ```sh
   cp node_modules/roadmapper/data/sample.roadmap.json roadmap.json
   ```

3. Check the install. The command prints `roadmap.json: no errors`.

   ```sh
   npx roadmapper validate
   ```

## What to do next

| Task | Doc |
|---|---|
| Run the commands | [commands.md](commands.md) |
| Use the app | [view.md](view.md) |
| Show the roadmap on a page of your project | [embed.md](embed.md) |
| Let Claude write and keep the roadmap file | [skill.md](skill.md) |

## Update

Run this command in your project's folder:

```sh
npm install roadmapper@latest
```

## What the package holds

| Part | Where in the package |
|---|---|
| The commands of `npx roadmapper` | `dist/cli/` |
| The lib | `dist/lib/` |
| The sample roadmap file | `data/sample.roadmap.json` |
| The docs, with the screenshots of the README | `docs/` |
| The README | `README.md` |
| The license | `LICENSE` |

The package installs no other package into your project.
