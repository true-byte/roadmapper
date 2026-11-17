# Embed a roadmap

::: basics
The lib puts a roadmap in a box on a page of your own project. Install Roadmapper in that project first, as [Install in your project](01-intro.md#install-in-your-project) says. Then follow the section for your page: a React app, a page with a bundler, or a page with no bundler.

::: details internals
The lib shows a roadmap in a box on a page of another project. That page can be a React app, a page with a bundler, or a page with no bundler. Install Roadmapper in the project first, as [Install in your project](01-intro.md#install-in-your-project) says.

::: internals
The code of the lib is in `src/lib/`. Each way puts the same tag on the page, `<roadmapper-view>`, which `src/lib/element.ts` defines. The tag puts the view of `mountRoadmap()`, from `src/view/view.ts`, in its shadow root. The React component renders that tag.

`npm run build:lib` builds the lib into `dist/lib/`, with the three builds of `vite.lib.config.ts`. The option `--mode` picks the build:

| Mode | Source | Files in `dist/lib/` |
|---|---|---|
| `module` | `src/lib/index.ts` and `src/lib/react.ts` | `index.js`, `react.js`, `element.js`, which the two share, and the icon set `tabler.js` |
| `script` | `src/lib/script.ts` | `roadmapper.js` |
| `export` | `src/lib/export-script.ts` | `roadmapper-page.js` |

[What the package holds](01-intro.md#internals/what-the-package-holds) says in which order the builds run, and where the types and the fonts go.
:::

The examples come from the sample roadmap file, 'Plant care app'.

## In a React app

::: basics
In a React app, the component `Roadmap` shows the box. It needs React 18 or later.

::: details internals
The React component needs React 18 or later.
:::

```jsx
import { Roadmap } from 'roadmapper/react';
import roadmap from './roadmap.json';

<Roadmap roadmap={roadmap} style={{ height: 720 }} />
```

::: basics
The prop `roadmap` takes the roadmap file. The prop `style` sets the size of the box.

::: details internals
| Prop | What it is |
|---|---|
| `roadmap` | The roadmap: the object of a roadmap file, as imported or parsed, or the text of the file. A new roadmap redraws the box in place. The same roadmap again leaves the box as it is, such as when the React app renders again. |
| `src` | The address of a roadmap file. The box reads the file itself. Give `src` in place of `roadmap`. |
| `className`, `style` | The class and the style of the box. They set the size of the box. |

The component draws in the browser. On a server, it renders an empty box, and the browser then draws in it.

::: internals
`Roadmap` in `src/lib/react.ts` passes `src`, the class and `style` to the tag, and keeps a ref to it.

- After the first render in the browser, an effect calls `defineRoadmapper()` with the icon sets of `src/icons/sets.ts`. A server runs no effect.
- A second effect sets the `roadmap` property of the tag each time the prop `roadmap` changes. It sets nothing while the prop is `undefined`.
- The component writes `className` as the attribute `class`. React 18 would write `className` on a tag of its own as an attribute named `classname`.
- `dist/lib/react.js` starts with `'use client';`. So a React app that renders on a server takes it as code for the browser.
- [What it needs](01-intro.md#internals/what-it-needs) says how the lib takes React from the app.
:::

## In a page with a bundler, without React

::: basics
In a page that a bundler builds, with no React, two steps show the box:
:::

1. Import the lib:

   ```js
   import 'roadmapper';
   ```

2. Put the tag in the page:

   ```html
   <roadmapper-view src="roadmap.json"></roadmapper-view>
   ```

   Or set the `roadmap` property of the tag, as [The tag](#the-tag) says.

::: details internals
When a project that imports the lib builds with Vite, Vite warns that a chunk is larger than 500 kB. You can ignore this warning. That chunk is the icon set, `tabler-*.js`, and it loads on its own, only when a roadmap is shown.

::: internals
- `import 'roadmapper'` loads `dist/lib/index.js`, as the key `exports` of `package.json` says. Its source, `src/lib/index.ts`, calls `defineRoadmapper()` with the icon sets of `src/icons/sets.ts`.
- The key `sideEffects` of `package.json` names `dist/lib/index.js` and `dist/lib/roadmapper.js`. So a bundler keeps an import of them that names nothing.
- `src/icons/sets.ts` loads Tabler Icons with `import('./tabler.js')`. So the bundler makes the icon set a chunk of its own.
- The first tag on the page loads that chunk, unless the tag holds the icons that it needs. `useIconSet()` in `src/icons/icons.ts` then keeps the set for every other box of the page.
:::

## In a page with no bundler

::: basics
In a page with no bundler, a `<script>` tag loads the lib:
:::

1. Copy the `roadmapper.js` of the lib, `node_modules/roadmapper/dist/lib/roadmapper.js`, into the folder of the page.
2. Copy the folder `node_modules/roadmapper/dist/lib/fonts/` next to it. The box loads the fonts from the folder `fonts/` next to `roadmapper.js`. Without it, the box draws in the fallback fonts.
3. Put these two lines in the page:

   ```html
   <script src="roadmapper.js" defer></script>
   <roadmapper-view src="roadmap.json"></roadmapper-view>
   ```

::: details internals
The page must use the UTF-8 encoding, as `<meta charset="utf-8">` sets it. Otherwise the symbols on the buttons show wrong.
:::

A page opened from disk cannot read a file by `src`. For such a page, put the text of the roadmap file inside the tag:

```html
<roadmapper-view>
  <script type="application/json">
    { "title": "Plant care app", "branches": [ … ] }
  </script>
</roadmapper-view>
```

::: internals
- `dist/lib/roadmapper.js` is in the format `iife`, with the global name `Roadmapper`. It defines the tag as soon as it runs.
- It holds the whole icon set, because a plain script cannot load a part of itself apart.
- It holds the symbols of the buttons as UTF-8 text, such as the `−` of the zoom control in `src/view/dom.ts`.
- While its first lines run, it reads its own address from `document.currentScript`. It loads each font from the folder `fonts/` next to that address.
- When the read of `src` fails, the tag takes the text of its `<script type="application/json">` in its place. It then logs no error.
- The tag reads that text once the page is parsed, because the tag can come before what it holds.
:::

## The tag

::: basics
`<roadmapper-view>` takes its roadmap in one of three ways: the `src` attribute, the `roadmap` property, or the text of a roadmap file inside it.

The `src` attribute holds the address of a roadmap file. The `roadmap` property takes the object of a roadmap file, or the text of the file. A new roadmap redraws the box in place.

::: details internals
`<roadmapper-view>` takes its roadmap in one of three ways.

| Way | What it is |
|---|---|
| The `src` attribute | The address of a roadmap file. The box reads the file itself, and reads it again when the address changes. |
| The `roadmap` property | The object of a roadmap file, or the text of the file. A new roadmap redraws the box in place. The same roadmap again leaves the box as it is. |
| A `<script type="application/json">` inside the tag | The text of a roadmap file, for a page opened from disk. With `src` too, the box draws this text only when it cannot read the file at `src`. |

- When the box cannot read the file at `src` and the tag holds no text of a roadmap file, the box shows the error list with `Unreadable file` and the address. The last good drawing stays under the error list.
- A roadmap given as an object, not as text, is checked as one line of text. So each row of its error list shows `1` under 'Line'.
- With the attribute `page`, the tag fills the whole page, as on the page of an HTML export. The wheel and the keys then work on the plan without a click first.
- For a screen reader, the tag is a region. Its name is `Roadmap: ` followed by the `title` of the roadmap, such as `Roadmap: Plant care app`. An `aria-label` on the tag replaces that name.

::: internals
`defineRoadmapper()` registers the tag with `customElements.define('roadmapper-view', …)`. It does nothing off a browser, or when the page already has the tag, as with a second copy of the lib.

When the tag goes on the page, these things happen in this order:

1. The tag sets `role="region"` and the name `Roadmap`, unless the page set them. It keeps an `aria-label` that the page set before this moment.
2. It gives its open shadow root one style sheet, which every box of the page shares: `src/view/view.css`, then the `theme.css` of the theme.
3. Until the view is made, a `<slot>` shows what the page wrote inside the tag.
4. It reads the name of the icon set, `--icon-set`, from the theme, and waits until the page is parsed. It takes the icons from a `<script type="application/json" data-icons>` inside the tag, or else loads the set.
5. It makes the view with `mountRoadmap()`. Then it draws the `roadmap` property, or else reads `src`, or else takes the text inside the tag.

- After each good draw, the tag writes its name again, unless the page named it. With `page`, it also sets the title of the page, as [The page of the export](04-export.md#the-page-of-the-export) says.
- A page can set `roadmap` before the lib defines the tag. The tag takes that value when it is made.
- The setter of `roadmap` stops a read of `src` that has not ended.
- The tag turns an object into text with `JSON.stringify()`. It keeps the last text that it drew, and never draws the same text again.
- `src` is the only attribute that the tag watches. An empty or removed `src` changes nothing.
- The tag reads `src` with `fetch(src, { cache: 'no-cache' })`.
- A status that is not OK counts as a failed read. When the tag holds no text either, the console gets `Roadmapper: the roadmap at <src> did not come.`
- The error list names the file by the last part of `src`, without the `?` or `#` and what follows them.
- With `page`, the tag has `position: fixed; inset: 0`, and the view takes the keys and the wheel of the whole window.
- When the tag leaves the page, it waits one microtask. A tag that is back by then, as after a move, keeps its view.
- A tag that stays off the page stops its read, removes the view, and empties its shadow root.
:::

## Imports

::: basics
| Import | What it gives |
|---|---|
| `roadmapper` | The tag `<roadmapper-view>`, which the import registers in the page. |
| `roadmapper/react` | The component `Roadmap`. |
| `roadmapper/roadmapper.js` | The lib as one plain script. |

::: details internals
| Import | What it gives |
|---|---|
| `roadmapper` | The tag `<roadmapper-view>`, which the import registers in the page, and the types `RoadmapFile`, `RoadmapInput` and `RoadmapperView`. |
| `roadmapper/react` | The component `Roadmap`, the type of its props `RoadmapProps`, and the types `RoadmapFile` and `RoadmapInput`. |
| `roadmapper/roadmapper.js` | The lib as one plain script. |

::: internals
The key `exports` of `package.json` gives the file of each import:

| Import | File | Types |
|---|---|---|
| `roadmapper` | `dist/lib/index.js` | `dist/lib/types/lib/index.d.ts` |
| `roadmapper/react` | `dist/lib/react.js` | `dist/lib/types/lib/react.d.ts` |
| `roadmapper/roadmapper.js` | `dist/lib/roadmapper.js` | None |

- `roadmapper` also exports `defineRoadmapper()`, which its import already calls.
- `RoadmapFile` is the type `Roadmap` of `src/roadmap/types.ts`.
- `RoadmapInput` is `Roadmap | string | Record<string, unknown>`. So a file read as JSON passes the type check, and the box checks it when it draws.
- `tsconfig.lib.json` writes the types of `src/lib/index.ts` and `src/lib/react.ts`, and of each file that they import.
:::

## Size and look

::: basics
The page sets the size of the box with its own CSS, as for any element. With no size set, the box is 560 px high and as wide as the element that holds it.

The box is light or dark as the device of the person who views the page is set.

::: details internals
- The page sets the size of the box with its own CSS, as for any element. The page can also hide the box.
- With no size set, the box is 560 px high and as wide as the element that holds it.
- The CSS of the page does not change the box, and the CSS of the box does not change the page.
- The colors and the fonts come from the theme. The box is light or dark as the device of the person who views the page is set. 'Light' or 'Dark' in the popup of the box changes only that box.

::: internals
- `src/view/view.css` styles the tag as `:host`, with `display: block`, `height: 560px` and `border-radius: 16px`. The CSS of the page wins over `:host`.
- `:host([hidden])` is `display: none`, so the attribute `hidden` hides the box.
- The root of the view in the box, `.roadmap.box`, starts with `all: initial`. It takes only `visibility` and `pointer-events` from the page.
- The styles of the view are in the shadow root, so they do not reach the page.
- Each color of the theme is a `light-dark()` value. The `color-scheme: light dark` of the root of the view picks one, as the device is set.
- 'Light' or 'Dark' sets `data-mode` on the root of the view.
- When the box has the focus from the keys, it shows a ring in the color `--line`.
:::

## Fonts

::: basics
The fonts of the theme ship with the lib. The box asks no other host for them.

In a React app or a page with a bundler, the bundler copies the font files into the build. Vite and webpack do this with no setting.

::: details internals
The fonts of the theme ship with the lib, in the folder `dist/lib/fonts/` of the package. The box loads each font file from the folder `fonts/` next to the lib's own files, only when a name needs its letters. It asks no other host.

- The lib adds the fonts to the page with the browser's font API, because a font that is named only inside the box does not load. It adds no element to the page.
- In a React app or a page with a bundler, the bundler copies the font files into the build. Vite and webpack do this with no setting.
- On a page with no bundler, the folder `fonts/` goes next to `roadmapper.js`, as [In a page with no bundler](#in-a-page-with-no-bundler) says.
- A Content-Security-Policy that allows fonts only from the page's own origin, `font-src 'self'`, lets the fonts load when the lib is served from that origin.
- Until a font has loaded, and when it cannot load, the box draws in the fallback fonts.

The dev server of Vite 7 or older does not serve the font files of the lib, so the box draws in the fallback fonts there. To serve them, add this line to the config in `vite.config.js`:

```js
optimizeDeps: { exclude: ['roadmapper'] },
```

::: internals
- `themeFonts()` in `src/themes/fonts.ts` is a plugin of each build. It reads the `@font-face` rules of the `fonts.css` of the theme that `src/themes/theme.css` names.
- Each `@font-face` names one woff2 file in the folder `fonts/` of the theme. The plugin writes that folder, with the license texts, next to the files of the build.
- The plugin gives the faces to the view as the module `virtual:theme-fonts`.
- In the `module` build, the address of each file is `new URL('./fonts/<file>?no-inline', import.meta.url)`. The bundler of the app follows it and copies the file.
- `?no-inline` keeps the Vite of an app from putting a file under 4 kB into its script as a `data:` address. A policy of `font-src 'self'` refuses such an address.
- Each `mountRoadmap()` calls `fontsOf()` in `src/view/fonts.ts`. It adds a `FontFace` to `document.fonts` for each face that the page does not have yet.
- `fontsOf()` tells two faces apart by family, style, weight and `unicode-range`. So a second box, or a second copy of the lib, adds no face twice.
- When a font has loaded, the view measures the names again. When their widths changed, it draws the plan again at the same level, scale and place.
:::

## In the box

::: basics details internals
| Do this | What happens |
|---|---|
| Turn the wheel up or down, or swipe up or down. | The page scrolls, as it does outside the box. |
| Drag, swipe sideways, move two fingers, or turn the wheel sideways. | The plan moves. |
| Pinch, or hold Ctrl and turn the wheel. | The plan grows or shrinks. |
| Click in the box. | The keys of the app work in the box, until you click outside it. A key typed into a field of the page still goes to that field. |

::: basics
Everything else works as in the app, as [Use the app](03-use-the-app.md) says. To export the roadmap, use the app, as [Export from the app](04-export.md#export-from-the-app) says.

::: details internals
- Everything else works as in the app, as [Use the app](03-use-the-app.md) says.
- The plan in the box runs across at any size, because the page scrolls up and down. 'Vertical' still makes it run down.
- Each visit opens the box the way the app opens the first time, as [What it remembers](03-use-the-app.md#internals/what-it-remembers) says.
- The side bar, the tip, the zoom control and the popup stay inside the box.
- The popup holds the parts 'Key' and 'View'. To export the roadmap, use the app, as [Export from the app](04-export.md#export-from-the-app) says.

::: internals
- Without the attribute `page`, the tag gets `tabindex="0"`, unless it has a `tabindex`. The view then takes the keys from the tag, not from the window.
- `src/view/input.ts` leaves a key to the page when its target is editable, or inside `input`, `textarea`, `select` or `[role="textbox"]`. It finds the target with `composedPath()`.
- In a box, `src/view/input.ts` takes the wheel over the box only. It leaves a turn without `ctrlKey` or `metaKey` to the page.
- The stage of a box has `overflow-y: hidden` in `src/view/view.css`. So a swipe up or down scrolls the page.
- Ctrl and the wheel call `scaleBy()` in `src/view/scale.ts`. It scales the plan around the pointer, and the level stays.
- A control that goes away under the pointer or a key, such as `×`, takes the focus with it. The tag then takes the focus back, and the page does not scroll.
- The rule `@container (width < 664px) and (orientation: portrait)` in `src/view/view.css` turns the plan down. It matches `.roadmap:not(.box)` only.
- `src/lib/element.ts` gives `mountRoadmap()` no `store`, so `src/view/store.ts` keeps nothing in `localStorage`. A box also reads nothing of the address of the page, such as `#z=1.5`.
- `:host` has `overflow: hidden` and `contain: layout paint style`, so each part of the view stays inside the box.
- The tag gives `mountRoadmap()` no `exportFile` and no `save`. So the popup has no part 'Export', and the zoom control has no 'Edit'.
:::

## Which roadmapper.js is which

::: basics
Two files are named `roadmapper.js`, and neither one can replace the other. The one of the lib holds every icon, and draws any roadmap file. The one of an HTML export draws only the icons of its own `roadmap.json`.

::: details internals
Two files are named `roadmapper.js`. Neither one can replace the other.

- The `roadmapper.js` of the lib is `node_modules/roadmapper/dist/lib/roadmapper.js` in a project that has Roadmapper installed, or `dist/lib/roadmapper.js` in a clone. It is the lib as one plain script. It holds the whole icon set and draws any roadmap file. It goes next to a page with no bundler.
- The `roadmapper.js` of an HTML export is in the folder of that export. It is the lib of the export. It holds no icon set: it draws only the icons that the `roadmap.json` of the export holds. It goes next to the `roadmap.json` and the `roadmap.html` of the export.

::: internals
- For the one of the lib, `src/lib/script.ts` calls `defineRoadmapper()` with the icon sets of `src/icons/sets.ts`.
- For the one of an export, `src/lib/export-script.ts` calls `defineRoadmapper()` with no icon set.
- `npx roadmapper export` writes `dist/lib/roadmapper-page.js` into the folder of the export as `roadmapper.js`. The app puts the same file into `roadmap.zip`.
- `src/cli/export.ts` writes the key `icons` into the `roadmap.json` of the export, with the license of the set. It holds the icons that the roadmap names, and those that the view draws itself.
- With no icon set, the tag takes the icons from the key `icons` of the file at `src`. When the read of `src` fails, it takes them from the text inside the tag.
- A tag with no `src` draws the text inside it with no icons, so its steps keep their marks.
- The tag takes only an icon that is a plain SVG drawing, with no script, handler, text or link out of it. `plain()` in `src/lib/element.ts` checks each icon.
- When a new file at `src` has other icons, the tag makes the view again, at its first level.
:::
