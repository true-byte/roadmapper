// The roadmap the app page draws: the text of the file, the name of the file, and the address that sends each save, when `roadmapper dev` serves the page.
// `npm run dev` gives it from the file (vite.config.ts); the built page reads it from its slot (src/app/slot.ts).
declare module 'virtual:roadmap' {
  const text: string;
  export default text;
  export const file: string;
  export const live: string | undefined;
}
