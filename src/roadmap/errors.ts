// The errors: the closed list of their names, and the one row each error is, as the file check, the commands and the page's error list say it.

/** The name of each error: the only words an error says. First those the file check finds; then those of a command, `npm run build`, `export` or `export:preview`:
 * a folder to write into that holds files the command did not write, a path to write into that is not a folder, an option the command does not take,
 * and a roadmap where every item is private, which the export for strangers cannot show. */
export const ERRORS = [
  'Invalid JSON', 'Unknown key', 'Missing key', 'Wrong type', 'Invalid value', 'Invalid date', 'Invalid URL', 'Duplicate id', 'Unknown id', 'Unreadable file',
  'Folder not empty', 'Not a folder', 'Unknown option', 'Nothing public',
] as const;
export type ErrorName = (typeof ERRORS)[number];

/** An error the file check finds. */
export interface FileError {
  /** The line of the file it is on, from 1. A roadmap given as data has no lines: 0. */
  line: number;
  /** What it is in, as the page names it: the top-level branch, the groups and branches in it, and the step, by its name or else its id. Empty for the roadmap itself. */
  path: string;
  /** The key, or empty for the piece itself and for a text that is not JSON. */
  key: string;
  error: ErrorName;
  /** The wrong value as the file writes it, or empty when there is none. */
  value: string;
}

/** An error as one line: its line, path, key, error and value, each in its place, two spaces apart. */
export const sayError = (e: FileError): string => [e.line || '', e.path, e.key, e.error, e.value].join('  ');
/** An error of a command as one line, in the same shape: where it is (a folder, a file or the command), the error, and the value, cut short when it is long. */
export const sayFailure = (where: string, error: ErrorName, value = ''): string => [where, error, cut(value)].join('  ');

/** A value of an error, cut short when it is long. */
export const cut = (s: string): string => (s.length > 60 ? `${s.slice(0, 59)}…` : s);

/** A roadmap that a piece of work cannot take, thrown with the name of its error: the caller tells it by that name, never by its words. */
export class RoadmapError extends Error {
  readonly error: ErrorName;
  constructor(error: ErrorName, message: string) {
    super(message);
    this.name = 'RoadmapError';
    this.error = error;
  }
}
