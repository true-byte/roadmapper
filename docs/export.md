# The HTML file and the HTML export

This doc covers the two ways to put a roadmap into files: the HTML file for you, and the HTML export for strangers. [commands.md](commands.md) gives the commands that write them, their folders and their errors.

The examples come from the sample roadmap file, 'Plant care app'.

## Which one to use

| | The HTML file | The HTML export |
|---|---|---|
| Who it is for | You | Strangers, on a site |
| Command | `npx roadmapper build` | `npx roadmapper export` |
| Files | `index.html` | `roadmap.html`, `roadmap.json` and `roadmapper.js` |
| Private items | Shown | Left out, unless you add `--private` |
| Opens from disk | Yes | No. Open it from a site, as [Why it must be opened from a site](#why-it-must-be-opened-from-a-site) says. |
| Remembers its level and place | Yes, as the app does | No |

## The HTML file

- It is the app page with the roadmap inside it: one file that holds the script, the styles and the roadmap.
- It works like the app, as [view.md](view.md) says. It does not redraw when the roadmap file changes. To show a change, run `npx roadmapper build` again.
- It shows the private items, so it is for you only. Strangers get the HTML export.
- In a clone, `npm run preview` serves it the way a site does.

## The files of the export

| File | What it is |
|---|---|
| `roadmap.html` | The page of the export. |
| `roadmap.json` | The roadmap that a stranger sees, with no private item, and the drawings of the icons that it names. |
| `roadmapper.js` | The lib of the export, which reads `roadmap.json` and draws it. It is not the `roadmapper.js` of the lib: [embed.md, section "Which roadmapper.js is which"](embed.md#which-roadmapperjs-is-which) tells them apart. |

## Put the export on a site

1. Export the roadmap, and check the export before you upload it:

   ```sh
   npx roadmapper export
   npx roadmapper preview
   ```

   Without `--private`, `npx roadmapper preview` serves only `dist/export/`, the folder that `npx roadmapper export` writes into when you name no folder. So run `npx roadmapper export` with no folder.

2. Upload the three files into one folder of the site. Upload the `roadmap.json` of the export, never your roadmap file: anyone can read what is on a site.

The page is at the address of that folder plus `roadmap.html`. On a host that drops the `.html`, the page is at that address plus `roadmap`.

## Show the export in a page of the site

To show the roadmap in a page that the site already has:

1. Put the `roadmapper.js` and the `roadmap.json` of the export next to that page.
2. Put these two lines in the page:

   ```html
   <script src="roadmapper.js" defer></script>
   <roadmapper-view src="roadmap.json"></roadmapper-view>
   ```

3. Set the size of the box, as [embed.md, section "Size and look"](embed.md#size-and-look) says.

## Upload again

After each change in this table, export again, then upload the files that the table names.

| After a change to | Upload |
|---|---|
| The roadmap file | `roadmap.json` |
| The `title` or the `about` of the roadmap | `roadmap.json` and `roadmap.html` |
| Roadmapper | All three files |

The browser asks the site each time whether `roadmap.json` has changed. So a stranger sees the new roadmap on the next visit.

## Why it must be opened from a site

When a browser opens the page from disk, it cannot read the `roadmap.json` next to it. The page then shows the error `Unreadable file`. Open the page from a site, or with `npx roadmapper preview`.

## The page of the export

- The page fills the whole window and works like the app. Each visit opens it the way the app opens the first time, as [view.md, section "What it remembers"](view.md#what-it-remembers) says.
- The title of the page is the `title` of the roadmap followed by ` · roadmap`, such as 'Plant care app · roadmap'.
- The `about` of the roadmap is the `<meta name="description">` of the page.
- Until the lib runs, the page shows 'Loading the roadmap…'.
- When the lib does not run, the page shows 'The roadmap could not load: roadmapper.js did not run.' It cannot show this when the Content-Security-Policy of the site forbids inline scripts.
- With JavaScript off, the page shows 'This roadmap needs JavaScript.'

## Private items

Without `--private`, the private items stay on this computer. [format.md, section "Private items"](https://github.com/true-byte/roadmapper/blob/main/.claude/skills/roadmapper/format.md#private-items) says what the export leaves out, and what the words of a shown item must not name. The export also follows these rules:

- It leaves no gap, lock or count where a private item was.
- It removes each group or branch that it leaves empty.
- When a branching keeps only one branch, and that branch comes back, the export puts its steps in place of the branching.
- The steps get new ids, `s1`, `s2` and so on, so that no id names a step that the export left out.
- No step keeps its `start`, `end` or `deadline`, so that a stranger cannot tell what is late.

A shown step that is neither done nor canceled gets `"waitsForPrivate": true` in either of these cases:

- Its `waitsFor` names a private step that is neither done nor canceled.
- It has not started, and each step right before it on its branch that is not done is private. A canceled step does not count: the steps right before the canceled step count in its place.

In 'Plant care app', the step 'Photo ID' gets `"waitsForPrivate": true`. It has not started, and 'Plant data deal', right before it, is private and not done.

## Keep the private items

To export the whole roadmap for those who may read all of it, add `--private` to both commands:

```sh
npx roadmapper export --private
npx roadmapper preview --private
```

The export then holds the whole roadmap, as the roadmap file has it. With no folder named, it writes into `dist/export-private/`, so that `dist/export/` never holds a private item. Each private item has its 'Private' tag, as in the app.
