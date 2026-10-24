# Embed a roadmap

This doc covers the lib, which shows a roadmap in a box on a page of another project. That page can be a React app, a page with a bundler, or a page with no bundler. Install Roadmapper in the project first, as [install.md](install.md) says.

The examples come from the sample roadmap file, 'Plant care app'.

## In a React app

The React component needs React 18 or later.

```jsx
import { Roadmap } from 'roadmapper/react';
import roadmap from './roadmap.json';

<Roadmap roadmap={roadmap} style={{ height: 720 }} />
```

| Prop | What it is |
|---|---|
| `roadmap` | The roadmap: the object of a roadmap file, as imported or parsed, or the text of the file. A new roadmap redraws the box in place. The same roadmap again leaves the box as it is, such as when the React app renders again. |
| `src` | The address of a roadmap file. The box reads the file itself. Give `src` in place of `roadmap`. |
| `className`, `style` | The class and the style of the box. They set the size of the box. |

The component draws in the browser. On a server, it renders an empty box, and the browser then draws in it.

## In a page with a bundler, without React

1. Import the lib:

   ```js
   import 'roadmapper';
   ```

2. Put the tag in the page:

   ```html
   <roadmapper-view src="roadmap.json"></roadmapper-view>
   ```

   Or set the `roadmap` property of the tag, as [The tag](#the-tag) says.

When a project that imports the lib builds with Vite, Vite warns that a chunk is larger than 500 kB. You can ignore this warning. That chunk is the icon set, `tabler-*.js`, and it loads on its own, only when a roadmap is shown.

## In a page with no bundler

1. Copy the `roadmapper.js` of the lib, `node_modules/roadmapper/dist/lib/roadmapper.js`, into the folder of the page.
2. Put these two lines in the page:

   ```html
   <script src="roadmapper.js" defer></script>
   <roadmapper-view src="roadmap.json"></roadmapper-view>
   ```

The page must use the UTF-8 encoding, as `<meta charset="utf-8">` sets it. Otherwise the symbols on the buttons show wrong.

A page opened from disk cannot read a file by `src`. For such a page, put the text of the roadmap file inside the tag:

```html
<roadmapper-view>
  <script type="application/json">
    { "title": "Plant care app", "branches": [ … ] }
  </script>
</roadmapper-view>
```

## The tag

`<roadmapper-view>` takes its roadmap in one of three ways.

| Way | What it is |
|---|---|
| The `src` attribute | The address of a roadmap file. The box reads the file itself, and reads it again when the address changes. |
| The `roadmap` property | The object of a roadmap file, or the text of the file. A new roadmap redraws the box in place. The same roadmap again leaves the box as it is. |
| A `<script type="application/json">` inside the tag | The text of a roadmap file, for a page opened from disk. With `src` too, the box draws this text only when it cannot read the file at `src`. |

- When the box cannot read the file at `src` and the tag holds no text of a roadmap file, the box shows the error list with `Unreadable file` and the address. The last good drawing stays under the error list.
- A roadmap given as an object, not as text, has no line numbers. So the rows of its error list show no 'Line'.
- With the attribute `page`, the tag fills the whole page, as on the page of an HTML export. The wheel and the keys then work on the plan without a click first.
- For a screen reader, the tag is a region. Its name is `Roadmap: ` followed by the `title` of the roadmap, such as `Roadmap: Plant care app`. An `aria-label` on the tag replaces that name.

## Imports

| Import | What it gives |
|---|---|
| `roadmapper` | The tag `<roadmapper-view>`, which the import registers in the page, and the types `RoadmapFile`, `RoadmapInput` and `RoadmapperView`. |
| `roadmapper/react` | The component `Roadmap`, the type of its props `RoadmapProps`, and the types `RoadmapFile` and `RoadmapInput`. |
| `roadmapper/roadmapper.js` | The lib as one plain script. |

## Size and look

- The page sets the size of the box with its own CSS, as for any element. The page can also hide the box.
- With no size set, the box is 560 px high and as wide as the element that holds it.
- The CSS of the page does not change the box, and the CSS of the box does not change the page.
- The lib adds one `<link rel="stylesheet">` to the `<head>` of the page, for the web fonts of the theme from Google Fonts. It does this because a font that is named only inside the box does not load.
- The colors and the fonts come from the theme. The box is light or dark as the device of the person who views the page is set. 'Light' or 'Dark' in the popup of the box changes only that box.

## In the box

| Do this | What happens |
|---|---|
| Turn the wheel up or down, or swipe up or down. | The page scrolls, as it does outside the box. |
| Drag, swipe sideways, move two fingers, or turn the wheel sideways. | The plan moves. |
| Pinch, or hold Ctrl and turn the wheel. | The plan grows or shrinks. |
| Click in the box. | The keys of the app work in the box, until you click outside it. A key typed into a field of the page still goes to that field. |

- Everything else works as in the app, as [view.md](view.md) says.
- The plan in the box runs across at any size, because the page scrolls up and down. 'Vertical' still makes it run down.
- Each visit opens the box the way the app opens the first time, as [view.md, section "What it remembers"](view.md#what-it-remembers) says.
- The side bar, the tip, the zoom control and the popup stay inside the box.
- The popup holds the parts 'Key' and 'View'. To export the roadmap, use the app, as [export.md, section "Export from the app"](export.md#export-from-the-app) says.

## Which roadmapper.js is which

Two files are named `roadmapper.js`. Neither one can replace the other.

- The `roadmapper.js` of the lib is `node_modules/roadmapper/dist/lib/roadmapper.js` in a project that has Roadmapper installed, or `dist/lib/roadmapper.js` in a clone. It is the lib as one plain script. It holds the whole icon set and draws any roadmap file. It goes next to a page with no bundler.
- The `roadmapper.js` of an HTML export is in the folder of that export. It is the lib of the export. It holds no icon set: it draws only the icons that the `roadmap.json` of the export holds. It goes next to the `roadmap.json` and the `roadmap.html` of the export.
