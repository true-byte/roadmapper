// The roadmap the app page draws: the text of the file, the name of the file, its key (src/cli/key.ts), the address that sends each save of the file, when `roadmapper dev` serves the page,
// and the address that 'Save' of 'Edit on page' sends the plan to, when `npm run dev` or `roadmapper dev` serves it.
// `npm run dev` gives it from the file (vite.config.ts); the built page reads it from its slot (src/app/slot.ts).
declare module 'virtual:roadmap' {
  const text: string;
  export default text;
  export const file: string;
  export const key: string;
  export const live: string | undefined;
  export const save: string | undefined;
}

// The export's lib, dist/lib/roadmapper-page.js, gzipped, in base64: vite.config.ts builds it from the source, and src/app/export.ts puts it into roadmap.zip.
declare module 'virtual:export-lib' {
  const gzipped: string;
  export default gzipped;
}
