import { inflateRawSync } from "node:zlib";

/**
 * The files inside a ZIP, read in Node from the bytes a browser saved.
 *
 * Reading a download on this side of the browser is the point: what a visitor
 * keeps is the saved file, so the check should not lean on the same browser
 * APIs that wrote it. Only the two methods Gizlet writes are understood —
 * stored and deflated — and anything else fails the test rather than being
 * skipped.
 */
export function zipEntries(archive: Buffer): { name: string; body: string }[] {
  const found: { name: string; body: string }[] = [];
  let position = 0;

  while (position < archive.length - 4 && archive.readUInt32LE(position) === 0x04034b50) {
    const method = archive.readUInt16LE(position + 8);
    const compressed = archive.readUInt32LE(position + 18);
    const nameLength = archive.readUInt16LE(position + 26);
    const extraLength = archive.readUInt16LE(position + 28);
    const name = archive.subarray(position + 30, position + 30 + nameLength).toString("utf8");
    const start = position + 30 + nameLength + extraLength;
    const payload = archive.subarray(start, start + compressed);

    if (method !== 0 && method !== 8) throw new Error(`${name} uses ZIP method ${method}.`);

    found.push({ name, body: (method === 0 ? payload : inflateRawSync(payload)).toString("utf8") });
    position = start + compressed;
  }

  return found;
}
