/**
 * Pictures for the Gizlets that have to actually encode something.
 *
 * A target-size control cannot be tested against the one-pixel PNG the other
 * image specs use: every limit is met at the first quality, which proves
 * nothing about a search and nothing about a limit that cannot be reached. What
 * these tests need is one picture that compresses to almost nothing and one
 * that refuses to, and the difference between them has to be reliable rather
 * than approximately true on the machine it was written on.
 *
 * They are BMPs because a BMP is a header and the pixels — no library, no
 * encoder, no compression to reason about — and every browser Gizlet supports
 * decodes one. What the browser then does with those pixels is the thing under
 * test.
 */

/** The 24-bit BMP wrapper around a block of bottom-up BGR rows. */
function bitmap(width: number, height: number, paint: (x: number, y: number) => readonly [number, number, number]): Buffer {
  const rowBytes = width * 3;
  const padding = (4 - (rowBytes % 4)) % 4;
  const pixelBytes = (rowBytes + padding) * height;
  const header = Buffer.alloc(54);

  header.write('BM', 0, 'ascii');
  header.writeUInt32LE(header.length + pixelBytes, 2);
  header.writeUInt32LE(header.length, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(width, 18);
  header.writeInt32LE(height, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(24, 28);
  header.writeUInt32LE(pixelBytes, 34);

  const pixels = Buffer.alloc(pixelBytes);
  let offset = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue] = paint(x, y);

      pixels[offset] = blue;
      pixels[offset + 1] = green;
      pixels[offset + 2] = red;
      offset += 3;
    }

    offset += padding;
  }

  return Buffer.concat([header, pixels]);
}

/**
 * Noise, which is the one thing lossy compression cannot do anything with.
 *
 * At 600 × 450 this stays tens of kilobytes even at the lowest quality the
 * search tries, so a one-kilobyte limit is genuinely out of reach rather than
 * narrowly missed. The generator is a fixed xorshift so every run gets the same
 * picture and the same answer.
 */
export function unsqueezableImage(width = 600, height = 450): Buffer {
  let state = 0x9e3779b9;

  return bitmap(width, height, () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;

    return [state & 0xff, (state >>> 8) & 0xff, (state >>> 16) & 0xff];
  });
}

/** A smooth gradient, which compresses to a small fraction of any usual limit. */
export function squeezableImage(width = 400, height = 300): Buffer {
  return bitmap(width, height, (x, y) => [
    Math.round((x / width) * 255),
    Math.round((y / height) * 255),
    128,
  ]);
}

/** A picture small enough that any JPEG of it is under a kilobyte or two. */
export function tinyImage(): Buffer {
  return bitmap(8, 8, () => [200, 120, 40]);
}
