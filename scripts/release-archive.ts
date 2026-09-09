import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

export const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
export const MAX_UNPACKED_BYTES = 512 * 1024 * 1024;
export const MAX_ENTRY_BYTES = 128 * 1024 * 1024;

export type NpmArchiveEntry = Readonly<{ path: string; bytes: number; mode: number; sha256: string; content: Uint8Array }>;
export type NpmArchiveInspection = Readonly<{ entries: readonly NpmArchiveEntry[]; packageJson: Uint8Array; unpackedBytes: number }>;

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = value >>> 1 ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function gunzipSingle(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 18 || bytes[0] !== 0x1f || bytes[1] !== 0x8b || bytes[2] !== 8) throw new Error('invalid gzip header');
  const flags = bytes[3]!; if (flags & 0xe0) throw new Error('invalid gzip flags'); let offset = 10;
  const need = (count: number) => { if (offset + count > bytes.length) throw new Error('truncated gzip header'); };
  if (flags & 4) { need(2); const size = bytes[offset]! | bytes[offset + 1]! << 8; offset += 2; need(size); offset += size; }
  const skipString = () => { while (offset < bytes.length && bytes[offset] !== 0) offset++; need(1); offset++; };
  if (flags & 8) skipString(); if (flags & 16) skipString(); if (flags & 2) { need(2); offset += 2; }
  let inflated: ReturnType<typeof inflateRawSync> & { engine?: { bytesWritten?: number } };
  try { inflated = inflateRawSync(bytes.subarray(offset), { info: true, maxOutputLength: MAX_UNPACKED_BYTES + 1024 }) as typeof inflated; }
  catch (error) { throw new Error(`invalid gzip deflate stream: ${String(error)}`); }
  const output = new Uint8Array((inflated as any).buffer), consumed = Number((inflated as any).engine?.bytesWritten);
  if (!Number.isSafeInteger(consumed) || consumed <= 0) throw new Error('gzip consumed-byte evidence unavailable');
  const trailer = offset + consumed; if (trailer + 8 !== bytes.length) throw new Error('gzip must contain exactly one member with no trailing bytes');
  const view = new DataView(bytes.buffer, bytes.byteOffset + trailer, 8);
  if (view.getUint32(0, true) !== crc32(output) >>> 0 || view.getUint32(4, true) !== output.byteLength >>> 0) throw new Error('gzip trailer checksum or size mismatch');
  return output;
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function headerText(header: Uint8Array, start: number, length: number, field: string): string {
  const bytes = header.subarray(start, start + length);
  const nul = bytes.indexOf(0);
  const end = nul < 0 ? bytes.length : nul;
  if (nul >= 0 && bytes.subarray(nul).some(byte => byte !== 0)) throw new Error(`tar ${field} contains ambiguous NUL data`);
  return Buffer.from(bytes.subarray(0, end)).toString('utf8');
}

function octal(header: Uint8Array, start: number, length: number, field: string): number {
  const bytes = header.subarray(start, start + length), nul = bytes.indexOf(0);
  if (nul >= 0 && bytes.subarray(nul + 1).some(byte => byte !== 0 && byte !== 32)) throw new Error(`invalid tar ${field} NUL suffix`);
  const raw = Buffer.from(bytes.subarray(0, nul < 0 ? bytes.length : nul)).toString('ascii').trim();
  if (!/^[0-7]+$/.test(raw)) throw new Error(`invalid tar ${field}`);
  const value = Number.parseInt(raw, 8);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`invalid tar ${field}`);
  return value;
}

function validatePath(path: string): void {
  if (!path || path.startsWith('/') || path.includes('\\') || path.includes('\0')) throw new Error(`unsafe archive path: ${path}`);
  const parts = path.split('/');
  if (parts.some(part => part === '' || part === '.' || part === '..')) throw new Error(`unsafe archive path: ${path}`);
  if (parts[0] !== 'package') throw new Error(`archive entry is outside package/: ${path}`);
}

export function inspectNpmArchive(bytes: Uint8Array): NpmArchiveInspection {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ARCHIVE_BYTES) throw new Error('archive size exceeds limit or is empty');
  let tar: Uint8Array;
  try { tar = gunzipSingle(bytes); }
  catch (error) { throw new Error(`invalid gzip archive: ${String(error)}`); }
  if (tar.byteLength > MAX_UNPACKED_BYTES) throw new Error('unpacked archive size exceeds limit');
  const entries: NpmArchiveEntry[] = [];
  const allPaths = new Set<string>();
  const regularPaths = new Set<string>();
  let offset = 0, zeroBlocks = 0, unpackedBytes = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) {
      zeroBlocks++;
      offset += 512;
      if (zeroBlocks === 2) break;
      continue;
    }
    if (zeroBlocks) throw new Error('tar has a single zero block');
    const storedChecksum = octal(header, 148, 8, 'checksum');
    let sum = 0;
    for (let index = 0; index < header.length; index++) sum += index >= 148 && index < 156 ? 32 : header[index]!;
    if (storedChecksum !== sum) throw new Error('tar checksum mismatch');
    if (Buffer.from(header.subarray(257, 263)).toString('binary') !== 'ustar\0' || Buffer.from(header.subarray(263, 265)).toString('ascii') !== '00') throw new Error('invalid tar ustar magic or version');
    const name = headerText(header, 0, 100, 'name');
    const prefix = headerText(header, 345, 155, 'prefix');
    const path = prefix ? `${prefix}/${name}` : name;
    validatePath(path);
    if (allPaths.has(path)) throw new Error(`duplicate archive entry: ${path}`);
    for (const regularPath of regularPaths) if (path.startsWith(`${regularPath}/`)) throw new Error(`archive directory/file prefix collision: ${path}`);
    allPaths.add(path);
    const size = octal(header, 124, 12, 'size');
    const mode = octal(header, 100, 8, 'mode');
    if (size > MAX_ENTRY_BYTES) throw new Error(`archive entry exceeds size limit: ${path}`);
    const type = header[156];
    const regular = type === 0 || type === 48;
    const directory = type === 53;
    if (!regular && !directory) throw new Error(`unsupported archive entry type for ${path}`);
    if (directory && size !== 0) throw new Error(`directory has content: ${path}`);
    const dataStart = offset + 512, dataEnd = dataStart + size;
    if (dataEnd > tar.length) throw new Error(`truncated archive entry: ${path}`);
    if (regular) {
      for (const prior of regularPaths) {
        if (path.startsWith(`${prior}/`) || prior.startsWith(`${path}/`)) throw new Error(`archive prefix collision: ${path}`);
      }
      regularPaths.add(path);
      const content = new Uint8Array(tar.subarray(dataStart, dataEnd));
      entries.push(Object.freeze({ path, bytes: size, mode, sha256: sha256(content), content }));
      unpackedBytes += size;
      if (unpackedBytes > MAX_UNPACKED_BYTES) throw new Error('unpacked archive size exceeds limit');
    }
    const nextOffset = dataStart + Math.ceil(size / 512) * 512;
    if (tar.subarray(dataEnd, nextOffset).some(byte => byte !== 0)) throw new Error(`archive entry has nonzero padding: ${path}`);
    offset = nextOffset;
  }
  if (zeroBlocks !== 2) throw new Error('truncated tar terminator');
  if (tar.subarray(offset).some(byte => byte !== 0)) throw new Error('tar contains trailing junk');
  entries.sort((left, right) => left.path.localeCompare(right.path));
  const packageEntry = entries.find(entry => entry.path === 'package/package.json');
  if (!packageEntry) throw new Error('archive is missing package/package.json');
  return Object.freeze({ entries: Object.freeze(entries), packageJson: packageEntry.content, unpackedBytes });
}
