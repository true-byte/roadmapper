// The icon sets that a theme can name, each with the license that must ship with its drawings.
// The theme names its set in its theme.css, as --icon-set. A set is big, so no view holds one of its own: the page that shows views puts it in first, with useIconSet().

export interface IconSet {
  /** The drawings are made for a box of `size` by `size`. */
  size: number;
  /** The drawing of an icon, by its name: SVG markup in one color, currentColor. None when the set does not have it. */
  art(name: string): string | undefined;
  /** The license of the drawings. It ships with them, in the built page. */
  license: string;
  /** The names of all its icons, for the grid of icons of 'Edit on page'. A set that holds only the icons a page draws may give none. */
  names?(): string[];
}

/** The icons the view draws itself, from the set the theme names: the arrows of the side bar and of the edge of the page. */
export const ARROW = { left: 'arrow-left', right: 'arrow-right' };
/** The glyphs of the tools button: the gear that opens the popup with the parts 'Key', 'View' and 'Export', and the chevron of the heading of each part. */
export const TOOLS = { open: 'settings', fold: 'chevron-down' };
/** The glyphs of the mode in the popup: the device's setting, light and dark. */
export const MODE = { device: 'device-desktop', light: 'sun', dark: 'moon' };
/** The glyphs of the list of top-level branches: the button that opens it, its search, and the pill of a step in a hidden branch. */
export const BRANCHES = { open: 'stack-2', search: 'search', hidden: 'eye-off' };
/** The glyphs of the 'Links' part of the side bar: the icon of a link that names no icon of the set, the arrow that says a link opens in a new tab, and the chevron of its heading. */
export const LINKS = { link: 'link', open: 'external-link', fold: 'chevron-down' };
/** The glyphs of the button 'Export' in the popup of the app: before a click, and for 2 s after, while it says 'Saved'. */
export const EXPORT = { save: 'download', saved: 'check' };
/** The glyphs of the grip that hides the zoom control and brings it back. */
export const GRIP = { hide: 'chevron-down', show: 'chevron-up' };
/** The glyphs of 'Edit on page': the buttons 'Edit', 'Cancel' and 'Save' on the zoom control, the trash under a step, the '+' of the marks and of a new row,
 * the remove of a row, the '+' of a new link, the lock of 'Private' on and off, the face of a step with no icon, and the search of the grid of icons and of 'Waits for'.
 * Only a page that saves its file shows them: never an export. */
export const EDIT = { edit: 'pencil', cancel: 'x', save: 'check', trash: 'trash', add: 'plus', remove: 'x', link: 'link-plus', locked: 'lock', open: 'lock-open', face: 'photo', search: 'search' };

/** What the view reads of a set in the Iconify format. Written out here, so the types of the lib need no package of a set. */
interface Iconify {
  icons: Record<string, { body: string }>;
  aliases?: Record<string, { parent: string }>;
  height?: number;
}

/** A set in the Iconify format. An alias that only renames an icon is read as that icon. */
export function iconify(data: Iconify, license: string): IconSet {
  const art = (name: string): string | undefined => {
    if (Object.hasOwn(data.icons, name)) return data.icons[name].body;
    const alias = data.aliases && Object.hasOwn(data.aliases, name) ? data.aliases[name] : undefined;
    return alias && Object.keys(alias).length === 1 && Object.hasOwn(data.icons, alias.parent) ? data.icons[alias.parent].body : undefined;
  };
  return { size: data.height ?? 24, art, license, names: () => Object.keys(data.icons) };
}

const SETS: Record<string, IconSet> = {};

/** Puts a set on the page under the name a theme gives it. */
export function useIconSet(name: string, set: IconSet): void {
  SETS[name] = set;
}

/** The set a theme names, or none when no set by that name is on the page. */
export const iconSet = (name: string): IconSet | undefined => (Object.hasOwn(SETS, name) ? SETS[name] : undefined);
