/**
 * The `.ico` container, written by hand.
 *
 * An ICO is a six-byte header, one sixteen-byte record per image, and then the
 * images. Since Windows Vista those images may be PNGs rather than bitmaps, and
 * every browser and operating system in use reads that — which means an ICO can
 * be assembled out of PNGs the browser has already encoded, with no bitmap
 * encoder, no dependency, and a file of a few kilobytes instead of tens.
 *
 * That makes this what the rest of `src/data` is: a pure function over bytes,
 * testable without a browser, with the browser only asked for the PNGs.
 */

export interface IcoImage {
  /** The square side, which an ICO record stores as a single byte. */
  readonly size: number;
  /** The PNG bytes for that size. */
  readonly png: Uint8Array;
}

const headerSize = 6;
const recordSize = 16;

/** An ICO stores a side of 256 as 0, which is the format's own convention. */
function sideByte(size: number): number {
  return size >= 256 ? 0 : size;
}

export const maximumIcoSize = 256;

/**
 * Writes the images as one ICO.
 *
 * The records come first, all of them, and then the payloads — so every offset
 * is known before anything is written, which is why this is one pass rather
 * than two.
 */
export function createIcoFile(images: readonly IcoImage[]): Uint8Array<ArrayBuffer> {
  if (images.length === 0) throw new Error('An ICO needs at least one image.');

  for (const image of images) {
    if (!Number.isInteger(image.size) || image.size < 1 || image.size > maximumIcoSize) {
      throw new Error(`An ICO holds square images from 1 to ${maximumIcoSize} pixels.`);
    }
  }

  const payloadOffset = headerSize + recordSize * images.length;
  const total = images.reduce((bytes, image) => bytes + image.png.length, payloadOffset);
  const file = new Uint8Array(total);
  const view = new DataView(file.buffer);

  // Reserved, then type 1 (icon rather than cursor), then the count.
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, images.length, true);

  let record = headerSize;
  let payload = payloadOffset;

  for (const image of images) {
    view.setUint8(record, sideByte(image.size));
    view.setUint8(record + 1, sideByte(image.size));
    // No colour palette, and one plane at 32 bits: what a PNG payload is.
    view.setUint8(record + 2, 0);
    view.setUint8(record + 3, 0);
    view.setUint16(record + 4, 1, true);
    view.setUint16(record + 6, 32, true);
    view.setUint32(record + 8, image.png.length, true);
    view.setUint32(record + 12, payload, true);

    file.set(image.png, payload);
    record += recordSize;
    payload += image.png.length;
  }

  return file;
}
