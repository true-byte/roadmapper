// The key of a roadmap file, which the app page keeps its view under (src/app/main.ts): two files never share a view, and a file keeps its view through each save.
// It comes from the full path of the file, never from its text. It is a hash of that path, so the page never shows where the file is on the disk.
/// <reference types="node" />
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export const fileKey = (file: string): string => createHash('sha256').update(resolve(file)).digest('hex').slice(0, 16);
