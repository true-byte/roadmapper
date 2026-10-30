// What 'Export' in the popup of the app saves: roadmap.zip, which holds the three files that `npx roadmapper export` writes, with the same bytes for the same
// roadmap file: the page and the roadmap from exportFiles() (src/cli/export.ts), and the export's lib, which the page holds (vite.config.ts).
// main.ts loads this module only when 'Export' is pressed.
import lib from 'virtual:export-lib';
import { exportFiles, FILES } from '../cli/export.js';
import { zip } from './zip.js';

/** The name of the file that 'Export' saves. */
export const ZIP_NAME = 'roadmap.zip';

/** roadmap.zip, from the text of a roadmap file: the export for strangers, or with `private` the whole roadmap, as `npx roadmapper export --private` gives it.
 * It throws what exportFiles() throws, such as the RoadmapError 'Nothing public' for a roadmap where everything is private. */
export async function exportZip(text: string, keep: { private: boolean }): Promise<File> {
  const files = await exportFiles(text, keep);
  const utf8 = new TextEncoder();
  const bytes = zip([
    { name: FILES.page, data: utf8.encode(files.page) },
    { name: FILES.roadmap, data: utf8.encode(files.roadmap) },
    { name: FILES.lib, data: await unpack(lib) },
  ]);
  return new File([bytes], ZIP_NAME, { type: 'application/zip' });
}

/** The bytes of the export's lib, from the gzip in base64 that the page holds. */
async function unpack(base64: string): Promise<Uint8Array> {
  const gzipped = new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))]);
  return new Uint8Array(await new Response(gzipped.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}
