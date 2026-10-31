// 'Save' of 'Edit on page': the page sends its plan to the dev server that served it, and the server writes the plan into the roadmap file it serves.
// The dev server of `npm run dev` (vite.config.ts) and that of `npx roadmapper dev` (src/cli/cli.ts) both answer with saveRequest().
// A plan that the file check refuses is not written, and the page gets the errors.
/// <reference types="node" />
import { writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { isIP } from 'node:net';
import { checkRoadmap } from '../roadmap/check.js';
import type { FileError } from '../roadmap/errors.js';

/** The address on the dev server that takes the plan. The page learns it from what the server serves: src/app/slot.ts, or 'virtual:roadmap' in vite.config.ts. */
export const SAVE = '/save';

/** The most a plan sent may weigh, in bytes. */
const MOST = 16 * 1024 * 1024;

/** The text of the roadmap file that a plan is written as. */
export const fileText = (plan: unknown): string => `${JSON.stringify(plan, null, 2)}\n`;

/** Writes the plan in `body`, the text of its JSON, into `file` as fileText() gives it, once the file check takes that text.
 * Gives the errors of the check, with the lines of that text; none when the file is written. */
export function savePlan(file: string, body: string): FileError[] {
  let plan: unknown;
  try {
    plan = JSON.parse(body);
  } catch {
    return checkRoadmap(body).errors;
  }
  const text = fileText(plan);
  const { errors } = checkRoadmap(text);
  if (!errors.length) writeFileSync(file, text);
  return errors;
}

/** Answers a POST of the plan as JSON: 200 when the file is written, 422 when the check refuses the plan, each with `{ errors }`.
 * It takes only what the page of this server sends: JSON, from a page of this host, and a host that is this computer or an IP address,
 * so another site in the browser cannot send a plan. Anything else is refused and writes nothing. */
export function saveRequest(file: string): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (req.method !== 'POST') return reply(res, 405, []);
    if (!fromPage(req)) return reply(res, 403, []);
    const parts: Buffer[] = [];
    let size = 0;
    req.on('data', (part: Buffer) => {
      size += part.length;
      if (size <= MOST) parts.push(part);
    });
    req.on('end', () => {
      if (size > MOST) return reply(res, 413, []);
      let errors: FileError[];
      try {
        errors = savePlan(file, Buffer.concat(parts).toString('utf8'));
      } catch {
        // the file could not be written
        return reply(res, 500, []);
      }
      reply(res, errors.length ? 422 : 200, errors);
    });
  };
}

/** Did the page of this server send the request? JSON, which a page of another site cannot send without the server's leave; an Origin, when there is one,
 * of the same host; and a host that is this computer or an IP address, so that a site's own name that leads to this computer is refused. */
function fromPage(req: IncomingMessage): boolean {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') return false;
  const host = req.headers.host;
  if (!host) return false;
  const origin = req.headers.origin;
  if (origin !== undefined) {
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }
  let name: string;
  try {
    name = new URL(`http://${host}`).hostname.replace(/^\[|\]$/g, '');
  } catch {
    return false;
  }
  return name === 'localhost' || name.endsWith('.localhost') || isIP(name) !== 0;
}

function reply(res: ServerResponse, status: number, errors: FileError[]): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify({ errors }));
}
