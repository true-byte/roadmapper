// The icon sets that a theme can name, each with the license that must ship with its drawings.
// The theme names its set in its theme.css, as --icon-set. A set is big, so no view holds one of its own: the page that shows views puts it in first, with useIconSet().

export interface IconSet {
  /** The drawings are made for a box of `size` by `size`. */
  size: number;
  /** The drawing of an icon, by its name: SVG markup in one color, currentColor. None when the set does not have it. */
  art(name: string): string | undefined;
  /** The license of the drawings. It ships with them, in the built page. */
  license: string;
}

/** The icons the view draws itself, from the set the theme names: the arrows of the side bar and of the edge of the page. */
export const ARROW = { left: 'arrow-left', right: 'arrow-right' };
/** The glyph of the button that opens the popup with the key, the 'Hide node icons' switch and the layout. */
export const INFO = { open: 'info-circle' };
/** The glyphs of the list of top-level branches: the button that opens it, its search, and the pill of a step in a hidden branch. */
export const BRANCHES = { open: 'stack-2', search: 'search', hidden: 'eye-off' };
/** The glyphs of the grip that hides the zoom control and brings it back. */
export const GRIP = { hide: 'chevron-down', show: 'chevron-up' };

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
  return { size: data.height ?? 24, art, license };
}

const SETS: Record<string, IconSet> = {};

/** Puts a set on the page under the name a theme gives it. */
export function useIconSet(name: string, set: IconSet): void {
  SETS[name] = set;
}

/** The set a theme names, or none when no set by that name is on the page. */
export const iconSet = (name: string): IconSet | undefined => (Object.hasOwn(SETS, name) ? SETS[name] : undefined);
