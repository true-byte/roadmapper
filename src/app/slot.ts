// The roadmap in the slot of the built app page, <script type="application/json" id="roadmap">, where `build` and `dev` put it (src/cli/cli.ts):
// the text of the file, the name of the file, its key (src/cli/key.ts), and for `dev` the address that sends each save. The build of the app page reads the module
// 'virtual:roadmap' from here; `npm run dev` gives it from the file itself (vite.config.ts).
const slot = document.getElementById('roadmap');
const data = JSON.parse(slot?.textContent || '{}') as { text?: string; file?: string; key?: string; live?: string };

export default data.text ?? '';
export const file = data.file ?? '';
export const key = data.key ?? '';
export const live = data.live;
