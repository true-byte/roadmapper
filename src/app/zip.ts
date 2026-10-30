// A zip file of a few files, as 'Export' in the app saves it (src/app/export.ts). Each file is stored as it is, with no compression, so the writer is small,
// and any unzip tool reads it. The format is PKWARE's APPNOTE.TXT: each file as a local header and its bytes, then the central directory, which lists each
// file again with where it starts, then the end record, which says where the central directory is.

/** A file to put into the zip: its name, which may hold a folder, as 'docs/roadmap.json', and its bytes. */
export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** The CRC-32 of each byte, by the polynomial that zip uses, 0xEDB88320. */
const TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

/** The CRC-32 of the bytes, as zip keeps it for each file. */
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** The zip file of the entries, in their order. Each file gets the time `at`, in local time, to the even second, as zip keeps it; a time before 1980, where zip's
 * times start, is the start of 1980. */
export function zip(entries: ZipEntry[], at = new Date()): Uint8Array<ArrayBuffer> {
  const t = at.getFullYear() < 1980 ? new Date(1980, 0, 1) : at;
  const time = (t.getHours() << 11) | (t.getMinutes() << 5) | (t.getSeconds() >> 1);
  const date = ((t.getFullYear() - 1980) << 9) | ((t.getMonth() + 1) << 5) | t.getDate();
  const utf8 = new TextEncoder();
  const files = entries.map(e => ({ name: utf8.encode(e.name), data: e.data, crc: crc32(e.data) }));
  const size = files.reduce((n, f) => n + 30 + f.name.length + f.data.length + 46 + f.name.length, 22);
  const out = new Uint8Array(size), view = new DataView(out.buffer);
  let pos = 0;
  const u16 = (v: number): void => { view.setUint16(pos, v, true); pos += 2; };
  const u32 = (v: number): void => { view.setUint32(pos, v, true); pos += 4; };
  const put = (bytes: Uint8Array): void => { out.set(bytes, pos); pos += bytes.length; };
  // what the local header and the central directory both say of a file: the version of zip it needs (1.0), the names in UTF-8 (bit 11), stored (method 0),
  // its time and date, its CRC-32, its size stored and its size, and the length of its name, with no extra field
  const common = (f: (typeof files)[number]): void => {
    u16(10); u16(0x0800); u16(0); u16(time); u16(date); u32(f.crc); u32(f.data.length); u32(f.data.length); u16(f.name.length); u16(0);
  };
  const starts: number[] = [];
  for (const f of files) {
    starts.push(pos);
    u32(0x04034b50); common(f); put(f.name); put(f.data);
  }
  const directory = pos;
  files.forEach((f, i) => {
    // made by zip 2.0 on MS-DOS; then no comment, disk 0, no attributes, and where its local header starts
    u32(0x02014b50); u16(20); common(f); u16(0); u16(0); u16(0); u32(0); u32(starts[i]); put(f.name);
  });
  // the end record: disk 0, the files on this disk and in all, the size of the central directory and where it starts, and no comment
  const end = pos;
  u32(0x06054b50); u16(0); u16(0); u16(files.length); u16(files.length); u32(end - directory); u32(directory); u16(0);
  return out;
}
