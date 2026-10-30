// The zip writer of src/app/zip.ts, which 'Export' in the app saves roadmap.zip with: each file stored as it is, then the central directory and the end record.
// The test reads the zip back as PKWARE's APPNOTE.TXT says, and checks each header against the one before it.
/// <reference types="node" />
import { crc32 as nodeCrc32 } from 'node:zlib';
import { expect, test } from '@playwright/test';
import { crc32, zip } from '../../src/app/zip';

/** A file as the zip holds it: its name, its bytes, and what its headers say of it. */
interface Unzipped {
  name: string;
  data: Buffer;
  crc: number;
  method: number;
  flags: number;
  version: number;
  time: number;
  date: number;
}

/** The files of a zip, read from the end record and the central directory. The files lie one after another from the start, each local header says
 * what the central directory says, and the central directory ends where the end record starts. */
function unzip(zip: Buffer): Unzipped[] {
  const end = zip.length - 22;
  expect(zip.readUInt32LE(end), 'the end record').toBe(0x06054b50);
  expect(zip.readUInt16LE(end + 20), 'no comment').toBe(0);
  const count = zip.readUInt16LE(end + 10), size = zip.readUInt32LE(end + 12), start = zip.readUInt32LE(end + 16);
  expect(zip.readUInt16LE(end + 8)).toBe(count);
  expect(start + size, 'the central directory ends where the end record starts').toBe(end);
  const files: Unzipped[] = [];
  let at = start, next = 0;
  for (let i = 0; i < count; i++) {
    expect(zip.readUInt32LE(at), 'a header of the central directory').toBe(0x02014b50);
    const nameLength = zip.readUInt16LE(at + 28), more = zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32), local = zip.readUInt32LE(at + 42);
    const name = zip.toString('utf8', at + 46, at + 46 + nameLength), stored = zip.readUInt32LE(at + 20);
    expect(local, 'each file starts where the one before it ends').toBe(next);
    expect(zip.readUInt32LE(local), 'a local header').toBe(0x04034b50);
    expect(zip.subarray(local + 4, local + 30), 'the local header says what the central directory says').toEqual(zip.subarray(at + 6, at + 32));
    expect(zip.toString('utf8', local + 30, local + 30 + nameLength)).toBe(name);
    const data = zip.subarray(local + 30 + nameLength, local + 30 + nameLength + stored);
    expect(zip.readUInt32LE(at + 24), 'stored as it is').toBe(stored);
    files.push({ name, data, crc: zip.readUInt32LE(at + 16), method: zip.readUInt16LE(at + 10), flags: zip.readUInt16LE(at + 8), version: zip.readUInt16LE(at + 6),
      time: zip.readUInt16LE(at + 12), date: zip.readUInt16LE(at + 14) });
    next = local + 30 + nameLength + stored;
    at += 46 + nameLength + more;
  }
  expect(next, 'the central directory starts after the last file').toBe(start);
  expect(at).toBe(end);
  return files;
}

test('the zip stores each file in order, with name, CRC-32 and time', () => {
  const utf8 = new TextEncoder();
  const files = [
    { name: 'roadmap.html', data: utf8.encode('<!doctype html>\n<title>Plant care app · roadmap</title>\n') },
    { name: 'data/plants é.json', data: utf8.encode('{"title":"Plant care app"}\n') },
    { name: 'empty.txt', data: new Uint8Array() },
  ];
  // 20 October 2026, 14:30:59, which zip keeps to the even second below
  const bytes = Buffer.from(zip(files, new Date(2026, 9, 20, 14, 30, 59)));
  expect(bytes.length).toBe(files.reduce((n, f) => n + 30 + 46 + 2 * Buffer.byteLength(f.name) + f.data.length, 22));
  const read = unzip(bytes);
  expect(read.map(f => f.name)).toEqual(files.map(f => f.name));
  read.forEach((f, i) => {
    expect(f.data.equals(Buffer.from(files[i].data)), f.name).toBe(true);
    expect(f.crc, f.name).toBe(nodeCrc32(files[i].data));
    // stored, with names in UTF-8, for zip 1.0
    expect([f.method, f.flags, f.version]).toEqual([0, 0x0800, 10]);
    expect([f.time >> 11, (f.time >> 5) & 63, (f.time & 31) * 2]).toEqual([14, 30, 58]);
    expect([(f.date >> 9) + 1980, (f.date >> 5) & 15, f.date & 31]).toEqual([2026, 10, 20]);
  });
});

test('crc32 gives the CRC-32 that zip gives', () => {
  expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  expect(crc32(new Uint8Array())).toBe(0);
});

test('a time before 1980 is the first day of 1980', () => {
  const [f] = unzip(Buffer.from(zip([{ name: 'a.txt', data: new Uint8Array([1, 2, 3]) }], new Date(1975, 5, 1, 12))));
  expect([f.time, f.date]).toEqual([0, (1 << 5) | 1]);
});

test('a zip with no file is the end record alone', () => {
  expect(Buffer.from(zip([])).toString('hex')).toBe(`504b0506${'0'.repeat(36)}`);
});
