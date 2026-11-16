# Commands

## How to read a command

::: basics
- You may leave out an argument in square brackets.
- `[file]` is the path of a roadmap file. With no `[file]`, `npx roadmapper` reads `roadmap.json` in the folder where you run it, or else `roadmap/roadmap.json` there.
- `[folder]` is the folder that the command writes into.
- In this doc, `build`, `dev`, `validate` and `export` each stand for both the `npx roadmapper` command and the `npm run` script of that name.

::: details internals
- You may leave out an argument in square brackets.
- `[file]` is the path of a roadmap file. With no `[file]`, `npx roadmapper` reads `roadmap.json` in the folder where you run the command, and without that file it reads `roadmap/roadmap.json` there. When neither file exists, the command prints `File not found`. With no `[file]`, `npm run` reads the file that [The roadmap files of the clone](#the-roadmap-files-of-the-clone) names.
- `[folder]` is the folder that the command writes into. With no `[folder]`, the command writes into the folder that [What each command writes](#what-each-command-writes) names.
- A path is relative to the folder where you run the command.
- With `--host`, a phone on the same Wi-Fi can also open the page, at the `Network` address that the command prints. Without `--host`, only this computer can open the page.
- `<version>` is the `version` in the `package.json` of Roadmapper.
- In this doc, `build`, `dev`, `validate` and `export` are short names. Each one stands for both the `npx roadmapper` command and the `npm run` script of that name.
- The short name `export:preview` stands for both `npx roadmapper preview` and `npm run export:preview`. `npm run preview` has no short name.

::: internals
`src/cli/cli.ts` holds the commands. Its function `run()` takes the command, the words typed after it, and a `Setup`, which gives the files and folders that the command uses:

| Field of `Setup` | What it holds | From `npx roadmapper`, in `src/cli/bin.ts` | From `npm run`, in `scripts/roadmapper.mjs` |
|---|---|---|---|
| `here` | The folder where you run the command | The current folder | `INIT_CWD`, the folder where you typed `npm run` |
| `name` | The name of the command in its errors | The word after `npx roadmapper`, or `roadmapper` | The name of the script |
| `files` | The roadmap files to read with no `[file]` | The list that `projectFiles()` gives | `roadmap/roadmap.json` of the clone |
| `app`, `export`, `exportPrivate` | The folders to write into with no `[folder]` | `dist/app`, `dist/export` and `dist/export-private` in `here` | The same folders in the clone |
| `page` | The app page with no roadmap in it | `dist/cli/app.html` of the package | `dist/cli/app.html` of the clone |
| `lib` | The lib of the export | `dist/lib/roadmapper-page.js` of the package | `dist/lib/roadmapper-page.js` of the clone |
| `fonts` | The folder of the fonts of the theme | `dist/lib/fonts` of the package | The folder `fonts/` of the theme in `src/themes/`, from `fontsFolder()` of `src/themes/fonts.ts` |

- `npx roadmapper` runs `dist/cli/roadmapper.js`, which the key `bin` of `package.json` names. `vite.cli.config.ts` builds it from `src/cli/bin.ts`, with all the code that it needs inside it.
- The scripts `validate`, `build`, `export` and `export:preview` run `scripts/roadmapper.mjs`. It loads `src/cli/cli.ts` from the source, through `runnerImport()` of Vite, and calls the same `run()`.
- Since `fonts` comes from the source, `npm run build` needs no build of the lib.
- npm runs each script in the root folder of the clone. `scripts/dev.mjs` also takes the folder where you typed the command from `INIT_CWD`.
- `run()` reads each path from `here` with `resolve()` of Node, and prints each path from `here`.
- `scripts/roadmapper.mjs` runs the command `preview` for the script `export:preview`, with `export:preview` as its `name`.
:::

## The `npx roadmapper` commands

Run these commands in the folder of a project that has Roadmapper installed. [Install in your project](01-intro.md#install-in-your-project) says how to install it.

::: basics
| Command | What it does |
|---|---|
| `npx roadmapper [file]` | Serves the app on the roadmap file, at the address that it prints. The page redraws each time you save the file. `npx roadmapper dev [file]` does the same. |
| `npx roadmapper build [file] [folder]` | Writes one HTML file: the app page with the roadmap inside it. |
| `npx roadmapper validate [file]` | Checks the roadmap file and prints each error. |
| `npx roadmapper export [file] [folder]` | Writes the HTML export of the roadmap file. |
| `npx roadmapper preview` | Serves the HTML export the way a site serves it. |
| `npx roadmapper --help` | Prints how to type each command. |

To stop `npx roadmapper` or `npx roadmapper preview`, press Ctrl+C.

::: details internals
| Command | What it does |
|---|---|
| `npx roadmapper [file] [--host]` | Does what `npx roadmapper dev` does. `[file]` must end in `.json`, or name a file or a folder that exists. |
| `npx roadmapper dev [file] [--host]` | Serves the app at port 5173. The app shows the roadmap file, and redraws it each time you save the file. The page has 'Edit', and its 'Save' writes the roadmap file, as [Edit on the page](03-use-the-app.md#edit-on-the-page) says. When the file has errors, the command keeps serving, and the page shows the error list. When the command cannot read the file at its start, it prints `File not found` or `Unreadable file` and stops. |
| `npx roadmapper build [file] [folder]` | Writes one HTML file: the app page with the roadmap inside it. |
| `npx roadmapper validate [file]` | Checks the roadmap file and prints each error. |
| `npx roadmapper export [--private] [file] [folder]` | Writes the HTML export of the roadmap file. With `--private`, the export keeps the private items. |
| `npx roadmapper preview [--private] [--host]` | Serves the HTML export at port 4173, the way a site serves it. With `--private`, it serves the export that keeps the private items. |
| `npx roadmapper --help` | Prints how to type each command. `npx roadmapper -h` prints the same text. |

- In each command, an option can go before, between or after the paths.
- `npx roadmapper dev` and `npx roadmapper preview` print the address of the page. They serve the page until you press Ctrl+C.
- The address that `npx roadmapper preview` prints ends in `roadmap.html`.
- When the port is in use, `npx roadmapper dev` and `npx roadmapper preview` use the next free port, up to 20 ports higher.

::: internals
- `COMMANDS` of `src/cli/cli.ts` gives how many paths each command takes, and which options. `USAGE` holds the text that `--help` prints.
- `run()` takes `--help` and `-h` only as the first word. Anywhere else, each one is an unknown option.
- With no command, `run()` runs `dev`. It also runs `dev` when `belongsToDev()` takes the first word: a word that starts with `-`, ends in `.json`, or names a path that exists.
- `run()` takes each word that starts with `-` as an option, and each other word as a path.

`npx roadmapper dev` reads the roadmap file, then the app page, and runs no file check at its start. `devServer()` answers these addresses:

| Address | What `npx roadmapper dev` answers |
|---|---|
| `/` | The app page, with the roadmap file in its slot, as [What each command writes](#what-each-command-writes) says. |
| `/events` | Each save of the roadmap file, as a server-sent event with the text and the name of the file. `src/app/main.ts` reads it with an `EventSource`. |
| `/save` | The plan that 'Save' sends, through `saveRequest()` of `src/cli/save.ts`. |
| `/fonts/<file>` | A file of the folder of the fonts. |
| Any other address | `404` and `Not found`. |

`npx roadmapper dev` watches the folder of the roadmap file with `watch()` of Node, not the file itself. Many editors save a file by putting a new file in its place. After a change, it waits until 40 ms pass with no other change. Then it reads the file, and sends the text only when the text changed.

`saveRequest()` takes a plan only from a page of the dev server. The request must be JSON, and its `Origin`, when it has one, must name the same host. The host must be `localhost`, a name that ends in `.localhost`, or an IP address. So another site in the browser cannot send a plan.

Once `checkRoadmap()` of `src/roadmap/check.ts` takes the plan, `saveRequest()` writes it into the roadmap file. It writes the plan as JSON with an indent of 2 spaces and a line break at the end. Each answer holds `{ errors }`:

| Answer | When |
|---|---|
| `200` | The plan is written into the roadmap file. |
| `422` | `checkRoadmap()` refuses the plan. `errors` lists each error. |
| `403` | The request breaks a rule of the paragraph above. |
| `405` | The request is not a `POST`. |
| `413` | The plan is bigger than 16 MB. |
| `500` | The roadmap file cannot be written. |

`preview` serves the folder `Setup.export`, or `Setup.exportPrivate` with `--private`. `previewServer()` serves only the three files of the export and the files of its folder `fonts/`. It also serves `roadmap.html` at `/roadmap`, as a host that drops the `.html` does. Every other address, such as `/`, gets `404` and `Not found`.

`serve()` listens on `localhost`, or with `--host` on every address of the computer. With `--host`, it prints a `Network` address for each IPv4 address that is not internal. When Node answers `EADDRINUSE`, `serve()` tries the next port. It throws every other error of the server.

Each file that `npx roadmapper dev` and `export:preview` serve has `cache-control: no-cache`. So the browser asks again on each load, and a new build or export shows on the next load.
:::

## The `npm run` scripts

Run these scripts in a clone of Roadmapper. To use Roadmapper in another folder, install it there, as [Install in your project](01-intro.md#install-in-your-project) says.

::: basics
| Command | What it does |
|---|---|
| `npm install` | Installs the packages that Roadmapper needs. Run it once, before any other command. |
| `npm run dev -- [file]` | Serves the app from the source of Roadmapper. The page redraws each time you save the roadmap file. |
| `npm run build -- [file] [folder]` | Builds the app page, then does what `npx roadmapper build` does. |
| `npm run validate -- [file]` | Does what `npx roadmapper validate` does. |
| `npm run export -- [file] [folder]` | Builds the lib, then does what `npx roadmapper export` does. |

::: details internals
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

::: internals
The key `scripts` of `package.json` gives the command that each script runs:

| Script | What it runs |
|---|---|
| `npm run dev` | `scripts/dev.mjs` |
| `npm run build` | `tsc --noEmit`, then `vite build`, then `scripts/roadmapper.mjs build` |
| `npm run preview` | `vite preview --outDir ../../dist/app` |
| `npm run validate` | `scripts/roadmapper.mjs validate` |
| `npm run export` | `scripts/build.mjs lib`, then `scripts/roadmapper.mjs export` |
| `npm run export:preview` | `scripts/roadmapper.mjs export:preview` |
| `npm run package` | `scripts/build.mjs lib cli`, then `scripts/pack.mjs` |

- `scripts/dev.mjs` takes the first argument as the roadmap file, unless it starts with `-`. It names the file to Vite in the variable `ROADMAP_FILE`, and runs Vite with the other arguments.
- Vite serves the app page, `src/app/index.html`, with the config `vite.config.ts`. The plugin `roadmapFile()` of that config gives the page the module `virtual:roadmap`. The module holds the text of the roadmap file, its name, its key and the address `/save`.
- Vite watches the roadmap file itself, with `addWatchFile()`, also outside the clone. On each save, it sends the module to the page again, and `src/app/main.ts` takes it through `import.meta.hot`.
- `roadmapFile()` answers `/save` with `saveRequest()`, as `npx roadmapper dev` does.
- The plugin `themeFonts()` of `src/themes/fonts.ts` serves the files of `fonts/`, with no `cache-control`.
- The plugin `watchSource` makes Vite watch all of `src/`, so a change to the source shows on the page too.
- `vite build` writes `dist/cli/app.html` through `vite-plugin-singlefile`, as one HTML file with the script and the styles inside it. In that build, the module `virtual:roadmap` is `src/app/slot.ts`.
- The root of Vite is `src/app`, so `--outDir ../../dist/app` is `dist/app/` of the clone.
- `scripts/build.mjs lib` checks the types with `tsc --noEmit`, and runs the builds `module`, `script` and `export` of `vite.lib.config.ts`. It also writes the types of the lib, with `tsc -p tsconfig.lib.json`.
- Its step `lib.export` runs the build `export`, which writes `dist/lib/roadmapper-page.js`.
- `scripts/build.mjs cli` builds `dist/cli/roadmapper.js` with `vite.cli.config.ts` in the step `cli.commands`. Then it builds the app page with `vite build` in the step `cli.app`.
- `scripts/build.mjs` starts each step once the steps that it needs have ended. At the first step that fails, it stops the other steps and ends with exit code 1.
- `scripts/pack.mjs` deletes each `dist/roadmapper-*.tgz`, then runs `npm pack --ignore-scripts --pack-destination dist`. `--ignore-scripts` skips the script `prepack`, which would build it all again.
- npm keeps an option typed with no `--` before it in a variable, such as `npm_config_private` for `--private`. `scripts/roadmapper.mjs` adds each option of the command that it finds there.
:::

### The roadmap files of the clone

::: basics
- `roadmap/roadmap.json` is the roadmap file of Roadmapper itself. A script that takes `[file]` reads it when you name no file.
- `roadmap/sample.roadmap.json` is the sample roadmap file, 'Plant care app'.

This command draws the sample roadmap file:

::: details internals
- `roadmap/roadmap.json` is the roadmap file of Roadmapper itself. A script that takes `[file]` reads it when you name no file.
- `roadmap/sample.roadmap.json` is the sample roadmap file, 'Plant care app'. [format.md, section "Example"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md#example) says what the sample holds.

A script that takes `[file]` reads the roadmap file that you name, in `roadmap/` or in any other folder. So one clone can hold many roadmap files and draw any one of them. This command draws the sample roadmap file:
:::

```sh
npm run dev -- roadmap/sample.roadmap.json
```

::: internals
`vite.config.ts` reads `roadmap/roadmap.json` when `ROADMAP_FILE` is not set, as for `npm run dev` with no `[file]`.
:::

## What each command writes

::: basics
| Command | What it writes | Where, with no `[folder]` |
|---|---|---|
| `build` | `index.html` and the folder `fonts/` | `dist/app/` |
| `export` | `roadmap.html`, `roadmap.json`, `roadmapper.js` and the folder `fonts/` | `dist/export/` |
| `dev` | The roadmap file, each time you click 'Save' on its page | No folder |

With no `[folder]`, `npx roadmapper` writes into `dist/` in the folder where you run it, and `npm run` writes into `dist/` in the clone. [The HTML file and the HTML export](04-export.md) says what the files of `build` and `export` are.

::: details internals
| Command | What it writes | Where, with no `[folder]` |
|---|---|---|
| `build` | `index.html`: the app page with the roadmap inside it, and the folder `fonts/`. [The HTML file and the HTML export](04-export.md) says what it is for. | `dist/app/` |
| `export` | `roadmap.html`, `roadmap.json`, `roadmapper.js` and the folder `fonts/`: the HTML export. [The HTML file and the HTML export](04-export.md) says what each file is. | `dist/export/`, or `dist/export-private/` with `--private` |
| `npm run package` | `roadmapper-<version>.tgz`: a package file that another project can install, to try a change of the clone. | `dist/` in the clone |
| `dev` | The roadmap file it serves, each time you click 'Save' on its page. | No folder |
| `validate`, `export:preview`, `npm run preview` | Nothing. | No folder |

- With no `[folder]`, `npx roadmapper` writes into `dist/` in the folder where you run it. With no `[folder]`, `npm run` writes into `dist/` in the clone.
- `export:preview` serves the folder that `export` writes into with no `[folder]`. `npm run preview` serves the folder that `npm run build` writes into with no `[folder]`.
- `build` and `export` print each file that they write, with its size, and the folder `fonts/`, with the size of all its files.
- `build` writes only into a folder that does not exist, is empty, or holds only the `index.html` of a build, with or without its folder `fonts/`. It writes over them.
- `export` writes only into a folder that does not exist, is empty, or holds exactly the three files of an export, with or without its folder `fonts/`. It writes over them, and never over the roadmap file that it reads.
- A folder `fonts/` that holds a file that Roadmapper does not write is someone's own. Then the command prints `Folder not empty` with the value `fonts/`.

::: internals
`build` makes its checks in this order, and writes only after the last one:

1. It reads the names of the files in the folder of the fonts.
2. It checks the folder to write into, with `refusal()`.
3. It checks the roadmap file, with `checked()`.
4. It reads the app page.

`export` makes its checks in this order, and writes only after the last one:

1. It checks that the lib of the export exists.
2. It reads the names of the files in the folder of the fonts.
3. It checks the folder to write into, with `refusal()`.
4. It checks that the `roadmap.json` in the folder is not the roadmap file that it reads, with `same()`.
5. It checks the roadmap file, with `checked()`.
6. `exportFiles()` of `src/cli/export.ts` makes the text of `roadmap.html` and `roadmap.json`.

- For `refusal()`, a folder or a link with the name of a file that the command writes is someone's own. A folder `fonts/` is the command's only when each thing in it is a file of the folder of the fonts.
- `same()` compares the device and the inode of the two paths. So a link or another path to the roadmap file counts as that file.
- `export` writes `roadmapper.js` as a copy of the lib of the export, `dist/lib/roadmapper-page.js`.
- Both commands copy the folder of the fonts into `fonts/` with `cpSync()` of Node.
- Each size that they print is the count of bytes divided by 1024 and rounded, and at least `1 kB`. The size of `fonts/` adds up all its files.

For `build` and `npx roadmapper dev`, `fillPage()` puts the roadmap into the slot of the app page, `<script type="application/json" id="roadmap">`. `src/app/slot.ts` reads the slot. The slot holds the text of the roadmap file, the name of the file and its key. For `npx roadmapper dev`, it also holds the addresses `/events` and `/save`.

`fillPage()` writes each `<` in the slot as `\u003c`, so no text of the roadmap can end the script. The key comes from `fileKey()` of `src/cli/key.ts`: the first 16 characters of the SHA-256 hash of the full path of the file. The app keeps its view under the key, so the page never shows where the file is on the disk.
:::

## The `validate` command

::: basics
[format.md, section "Errors"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md#errors) says what `validate` prints and what each error means.

::: details internals
`validate` checks a roadmap file. [format.md, section "Errors"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md#errors) says what it prints and what each error means. When the file has errors, the command ends with exit code 1. When the file has no error, it ends with exit code 0.

::: internals
`validate` runs `checked()` of `src/cli/cli.ts`. `checked()` reads the file, runs `checkRoadmap()` of `src/roadmap/check.ts`, and writes each error with `sayError()` of `src/roadmap/errors.ts`, after `<file>:`. `validate` prints these lines on standard output.
:::

## Errors

::: basics
When a command cannot do its work, it writes nothing and prints one line for each error. An error in the roadmap file prints the same way as in `validate`.

| Error | What it means |
|---|---|
| `File not found` | The roadmap file does not exist. Name a file that exists, or put the file where the command looks for it. |
| `Folder not empty` | The folder to write into holds a file that the command may not write over. |
| `Not a folder` | The path to write into is a file, or a part of the path is a file. |
| `Unknown option` | [Unknown option](#unknown-option) gives each case. |
| `Nothing public` | Every item is private, so the export for strangers has nothing to show. To export the whole roadmap, add `--private`. |
| `Unreadable file` | [Unreadable file](#unreadable-file) gives each file, and what to do. |

::: details internals
When a command cannot do its work, it writes nothing and ends with exit code 1. It prints one line for each error, with two spaces between the fields:

```text
<where>  <error>  <value>
```

- An error in the roadmap file prints the same way as in `validate`, and its `<where>` is `<file>:<line>  <path>  <key>`. [format.md, section "Errors"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md#errors) says what each field and each error means.
- The table below lists every other error. A long `<value>` is cut as [format.md, section "Errors"](https://github.com/true-byte/roadmapper/blob/master/.claude/skills/roadmapper/format.md#errors) says.

| `<error>` | Printed by | `<where>` | `<value>` | What it means |
|---|---|---|---|---|
| `File not found` | `validate`, `build`, `export`, `npx roadmapper dev` | The file that you named. With no `[file]`, each file that the command looks for: `roadmap.json, roadmap/roadmap.json` from `npx roadmapper`. | Empty | The roadmap file does not exist. Name a file that exists, or put the file where the command looks for it. |
| `Folder not empty` | `build`, `export` | The folder to write into | The files in the folder that the command does not write. When the folder holds only part of an export, the value is all the files in the folder. When the `roadmap.json` in the folder is the roadmap file that `export` reads, the value is `roadmap.json`. | The folder holds a file that the command may not write over, as [What each command writes](#what-each-command-writes) says. `export` also prints this error when the `roadmap.json` in the folder is the roadmap file that it reads. |
| `Not a folder` | `build`, `export` | The path to write into | Empty | The path is a file, or a part of the path is a file. |
| `Unknown option` | `validate`, `build`, `export`, `export:preview`, `npx roadmapper dev` | See [Unknown option](#unknown-option). | See [Unknown option](#unknown-option). | The command does not exist, does not take that option, or does not take that many paths. |
| `Nothing public` | `export` | The roadmap file | Empty | Every item is private, so the export for strangers has nothing to show. To export the whole roadmap, add `--private`. |
| `Unreadable file` | `validate`, `build`, `export`, `export:preview`, `npx roadmapper dev` | The file that the command cannot read | Empty | A file that the command needs cannot be read. See [Unreadable file](#unreadable-file). |

When the port and the 20 ports above it are in use, `npx roadmapper dev` and `npx roadmapper preview` stop with an error from Node. That error does not have the form above.

::: internals
- `fail()` of `src/cli/cli.ts` prints the line on standard error, and gives exit code 1. It writes the line with `sayFailure()` of `src/roadmap/errors.ts`.
- `sayFailure()` joins `<where>`, `<error>` and `<value>` with two spaces. It cuts a long value with `cut()`.
- `ERRORS` of `src/roadmap/errors.ts` is the closed list of the names of the errors: those of the file check, then those of the commands.
- `build` and `export` print the errors of the roadmap file from `checked()` on standard error.
- `publicRoadmap()` of `src/roadmap/public.ts` throws a `RoadmapError` named `Nothing public` when no top-level branch is left. `export` tells the error by its name, and prints it with the roadmap file as `<where>`.
- `run()` gives the exit code, and `src/cli/bin.ts` and `scripts/roadmapper.mjs` set it as `process.exitCode`. For `dev` and `preview`, `run()` gives no exit code, since they serve until you stop them.
:::

### Unknown option

::: basics
A command prints `Unknown option` in each of these cases:

- The command does not exist.
- The command does not take an option that you typed.
- You typed more paths than the command takes.

::: details internals
In this table, "the command" is the word that you type after `npm run` or `npx roadmapper`, such as `export:preview`. When more than one case holds, only the first one in the table prints.

| Case | `<where>` | `<value>` |
|---|---|---|
| The command does not exist, and the word does not end in `.json` or name a file or a folder that exists. | `roadmapper` | The command |
| The command does not take an option that you typed. | The command, or `roadmapper` when you typed no command | The first option that the command does not take |
| You typed more paths than the command takes. | The command, or `roadmapper` when you typed no command | The first path after the ones that the command takes |

`npm run dev` and `npm run preview` pass their options to Vite, and Vite prints its own errors.

::: internals
- `run()` checks the cases in the order of the table, and stops at the first one that holds.
- For the second and the third case, `<where>` is `Setup.name`. `run()` sets it to `roadmapper` when it runs `dev` with no command typed.
:::

### Unreadable file

::: basics
| The file that the command cannot read | What to do |
|---|---|
| The roadmap file | Name a file that you can read. |
| A file of the installed package | Install the package again. |
| `roadmap.html` in the folder that `npx roadmapper preview` serves | Run `export` first, with no `[folder]`. |

::: details internals
| Printed by | `<where>` | What to do |
|---|---|---|
| `validate`, `build`, `export`, `npx roadmapper dev` | The roadmap file, as `<file>:`. The path is a folder, or you have no permission to read the file. | Name a file that you can read. |
| `npx roadmapper build`, `npx roadmapper dev` | `dist/cli/app.html` in the installed package: the app page with no roadmap in it | Install the package again. |
| `npx roadmapper export` | `dist/lib/roadmapper-page.js` in the installed package: the lib of the export | Install the package again. |
| `export:preview` | `roadmap.html` in the folder that it serves: the page of the export | The folder holds no export to serve. Run `export` first, with no `[folder]`. When `export:preview` has `--private`, give `export` `--private` too. |

The package holds `dist/cli/app.html` and `dist/lib/roadmapper-page.js` already built. `npm run build` and `npm run export` build their file before they read it.

::: internals
- `read()` of `src/cli/cli.ts` gives no text when `readFileSync()` of Node throws. The command then prints `Unreadable file`.
- For the roadmap file, the line has the shape of an error of the file check, with an empty line, path, key and value. `checked()` prints it, and so does `npx roadmapper dev` at its start.
- For the lib of the export and for `roadmap.html`, `export` and `preview` check only that the file exists.
- `build` and `export` also print `Unreadable file` when they cannot read the folder of the fonts, `Setup.fonts`. Then `<where>` is that folder.
- The script `prepack` of `package.json` runs `scripts/build.mjs lib cli`, which builds both files, before npm packs the package.
:::
