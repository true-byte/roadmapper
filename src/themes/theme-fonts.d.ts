// The faces of the fonts of the theme, with the address of each file, as the build gives them (src/themes/fonts.ts). src/view/fonts.ts puts them on the page.
declare module 'virtual:theme-fonts' {
  export function faces(): import('../view/fonts.js').Face[];
}
