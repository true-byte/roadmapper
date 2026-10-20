# Install

This doc covers what Roadmapper needs, how to build its package, how to install and update it in your project, and what the package holds.

## What it needs

| Tool | Version | Needed for |
|---|---|---|
| Node | 20.19 or a later 20, or 22.12 or later | The clone and your project |
| npm | The version that comes with Node | The clone and your project |
| Git | Any version | The clone |
| React | The version that [embed.md](embed.md) gives | Only the React component of the lib |

Vite 8 builds Roadmapper, and Vite 8 needs one of these Node versions. The `engines` key in Roadmapper's `package.json` gives the same Node versions.

## Build the package

Your project installs Roadmapper from a package file. To build that file in a clone of Roadmapper, run these commands:

```sh
git clone https://github.com/true-byte/roadmapper
cd roadmapper
npm install
npm run package
```

`npm run package` writes the package file into `dist/`, as [commands.md, section "The `npm run` scripts"](commands.md#the-npm-run-scripts) says. `dist/` then holds only one package file.

## Install in your project

Follow these steps in your project's folder. `../roadmapper` stands for the path to the clone.

1. Install the package. This adds Roadmapper to your project's `package.json`, with the path of the package file.

   ```sh
   npm install ../roadmapper/dist/roadmapper-*.tgz
   ```

   Install the package file, not the folder of the clone. npm installs a folder as a link to it. That link gives a React app two copies of React, and then the box of the lib fails.

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

Follow these steps to update Roadmapper in your project.

1. Run these commands in the clone:

   ```sh
   git pull
   npm run package
   ```

2. In your project's folder, install the package again, as step 1 of [Install in your project](#install-in-your-project) says.

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
