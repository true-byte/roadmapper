# Commands

This doc covers the `npx roadmapper` commands and the `npm run` scripts that draw, check or export a roadmap file, or pack Roadmapper. For each one, it gives the arguments, the defaults, the files it writes and the errors.

## How to read a command

- You may leave out an argument in square brackets.
- `[file]` is the path of a roadmap file. With no `[file]`, `npx roadmapper` reads `roadmap.json` in the folder where you run the command. With no `[file]`, `npm run` reads the file that [The roadmap files of the clone](#the-roadmap-files-of-the-clone) names.
- `[folder]` is the folder that the command writes into. With no `[folder]`, the command writes into the folder that [What each command writes](#what-each-command-writes) names.
- A path is relative to the folder where you run the command.
- With `--host`, a phone on the same Wi-Fi can also open the page, at the `Network` address that the command prints. Without `--host`, only this computer can open the page.
- `<version>` is the `version` in the `package.json` of Roadmapper.
- In this doc, `build`, `dev`, `validate` and `export` are short names. Each one stands for both the `npx roadmapper` command and the `npm run` script of that name.
- The short name `export:preview` stands for both `npx roadmapper preview` and `npm run export:preview`. `npm run preview` has no short name.

## The `npx roadmapper` commands

Run these commands in the folder of a project that has Roadmapper installed. [install.md](install.md) says how to install it.

| Command | What it does |
|---|---|
| `npx roadmapper dev [file] [--host]` | Serves the app at port 5173. The app shows the roadmap file, and redraws it each time you save the file. The page has 'Edit', and its 'Save' writes the roadmap file, as [view.md, section "Edit on the page"](view.md#edit-on-the-page) says. When the file has errors, the command keeps serving, and the page shows the error list. When the command cannot read the file at its start, it prints `Unreadable file` and stops. |
| `npx roadmapper build [file] [folder]` | Writes one HTML file: the app page with the roadmap inside it. |
| `npx roadmapper validate [file]` | Checks the roadmap file and prints each error. |
| `npx roadmapper export [--private] [file] [folder]` | Writes the HTML export of the roadmap file. With `--private`, the export keeps the private items. |
| `npx roadmapper preview [--private] [--host]` | Serves the HTML export at port 4173, the way a site serves it. With `--private`, it serves the export that keeps the private items. |
| `npx roadmapper` | Prints how to type each command. `npx roadmapper --help` and `npx roadmapper -h` print the same text. |

- In each command, an option can go before, between or after the paths.
- `npx roadmapper dev` and `npx roadmapper preview` print the address of the page. They serve the page until you press Ctrl+C.
- The address that `npx roadmapper preview` prints ends in `roadmap.html`.
- When the port is in use, `npx roadmapper dev` and `npx roadmapper preview` use the next free port, up to 20 ports higher.

## The `npm run` scripts

Run these scripts in a clone of Roadmapper. To use Roadmapper in another folder, install it there, as [install.md](install.md) says.

| Command | What it does |
|---|---|
| `npm install` | Installs the packages that Roadmapper needs. Run it once, before any other command. |
| `npm run dev -- [file] [--host]` | Serves the app from the source of Roadmapper, through Vite, at port 5173. The app shows the roadmap file, and redraws it each time you save the file. The page has 'Edit', and its 'Save' writes the roadmap file. |
| `npm run build -- [file] [folder]` | Checks the types and builds `dist/cli/app.html`, the app page with no roadmap in it. Then it does what `npx roadmapper build` does. |
| `npm run preview -- [--host]` | Serves the HTML file in `dist/app/` through Vite, at port 4173, the way a site serves it. It serves no other folder. |
| `npm run validate -- [file]` | Does what `npx roadmapper validate` does. |
| `npm run export -- [--private] [file] [folder]` | Builds the lib, then does what `npx roadmapper export` does. |
| `npm run export:preview -- [--private] [--host]` | Does what `npx roadmapper preview` does. |
| `npm run package` | Builds the lib, the commands and the app page of the package. Then it deletes each older `dist/roadmapper-*.tgz`, and packs Roadmapper into `dist/roadmapper-<version>.tgz`. |

- In `npm run dev`, put the file before `--host`. Every argument after the file goes to Vite, such as `--port 3000`.
- `npm run preview` passes all its arguments to Vite.
- When the port of `npm run dev` or `npm run preview` is in use, Vite uses the next free port.
- An option also works without `--` before it in `npm run export` and `npm run export:preview`. For example, `npm run export --private` works.

### The roadmap files of the clone

- `data/roadmap.json` is the roadmap file of Roadmapper itself. A script that takes `[file]` reads it when you name no file.
- `data/sample.roadmap.json` is the sample roadmap file, 'Plant care app'. [format.md, section "Example"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md#example) says what the sample holds.

A script that takes `[file]` reads the roadmap file that you name, in `data/` or in any other folder. So one clone can hold many roadmap files and draw any one of them. This command draws the sample roadmap file:

```sh
npm run dev -- data/sample.roadmap.json
```

## What each command writes

| Command | What it writes | Where, with no `[folder]` |
|---|---|---|
| `build` | `index.html`: the app page with the roadmap inside it. [export.md](export.md) says what it is for. | `dist/app/` |
| `export` | `roadmap.html`, `roadmap.json` and `roadmapper.js`: the HTML export. [export.md](export.md) says what each file is. | `dist/export/`, or `dist/export-private/` with `--private` |
| `npm run package` | `roadmapper-<version>.tgz`: the package that another project installs. | `dist/` in the clone |
| `dev` | The roadmap file it serves, each time you click 'Save' on its page. | No folder |
| `validate`, `export:preview`, `npm run preview` | Nothing. | No folder |

- With no `[folder]`, `npx roadmapper` writes into `dist/` in the folder where you run it. With no `[folder]`, `npm run` writes into `dist/` in the clone.
- `export:preview` serves the folder that `export` writes into with no `[folder]`. `npm run preview` serves the folder that `npm run build` writes into with no `[folder]`.
- `build` and `export` print each file that they write, with its size.
- `build` writes only into a folder that does not exist, is empty, or holds only the `index.html` of a build. It writes over that `index.html`.
- `export` writes only into a folder that does not exist, is empty, or holds exactly the three files of an export. It writes over those three files, and never over the roadmap file that it reads.

## The `validate` command

`validate` checks a roadmap file. [format.md, section "Errors"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md#errors) says what it prints and what each error means. When the file has errors, the command ends with exit code 1. When the file has no error, it ends with exit code 0.

## Errors

When a command cannot do its work, it writes nothing and ends with exit code 1. It prints one line for each error, with two spaces between the fields:

```text
<where>  <error>  <value>
```

- An error in the roadmap file prints the same way as in `validate`, and its `<where>` is `<file>:<line>  <path>  <key>`. [format.md, section "Errors"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md#errors) says what each field and each error means.
- The table below lists every other error. A long `<value>` is cut as [format.md, section "Errors"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md#errors) says.

| `<error>` | Printed by | `<where>` | `<value>` | What it means |
|---|---|---|---|---|
| `Folder not empty` | `build`, `export` | The folder to write into | The files in the folder that the command does not write. When the folder holds only part of an export, the value is all the files in the folder. When the `roadmap.json` in the folder is the roadmap file that `export` reads, the value is `roadmap.json`. | The folder holds a file that the command may not write over, as [What each command writes](#what-each-command-writes) says. `export` also prints this error when the `roadmap.json` in the folder is the roadmap file that it reads. |
| `Not a folder` | `build`, `export` | The path to write into | Empty | The path is a file, or a part of the path is a file. |
| `Unknown option` | `validate`, `build`, `export`, `export:preview`, `npx roadmapper dev` | See [Unknown option](#unknown-option). | See [Unknown option](#unknown-option). | The command does not exist, does not take that option, or does not take that many paths. |
| `Nothing public` | `export` | The roadmap file | Empty | Every item is private, so the export for strangers has nothing to show. To export the whole roadmap, add `--private`. |
| `Unreadable file` | `npx roadmapper build`, `npx roadmapper dev`, `npx roadmapper export`, `export:preview` | The file that is missing | Empty | A file that the command needs is missing. See [Unreadable file](#unreadable-file). |

When the port and the 20 ports above it are in use, `npx roadmapper dev` and `npx roadmapper preview` stop with an error from Node. That error does not have the form above.

### Unknown option

In this table, "the command" is the word that you type after `npm run` or `npx roadmapper`, such as `export:preview`. When more than one case holds, only the first one in the table prints.

| Case | `<where>` | `<value>` |
|---|---|---|
| The command does not exist. | `roadmapper` | The command |
| The command does not take an option that you typed. | The command | The first option that the command does not take |
| You typed more paths than the command takes. | The command | The first path after the ones that the command takes |

`npm run dev` and `npm run preview` pass their options to Vite, and Vite prints its own errors.

### Unreadable file

| Printed by | `<where>` | What to do |
|---|---|---|
| `npx roadmapper build`, `npx roadmapper dev` | `dist/cli/app.html` in the installed package: the app page with no roadmap in it | Install the package again. |
| `npx roadmapper export` | `dist/lib/roadmapper-page.js` in the installed package: the lib of the export | Install the package again. |
| `export:preview` | `roadmap.html` in the folder that it serves: the page of the export | The folder holds no export to serve. Run `export` first, with no `[folder]`. When `export:preview` has `--private`, give `export` `--private` too. |

The package holds `dist/cli/app.html` and `dist/lib/roadmapper-page.js` already built. `npm run build` and `npm run export` build their file before they read it.
