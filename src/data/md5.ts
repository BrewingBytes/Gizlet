/**
 * MD5, because the platform refuses to provide it and one UUID version needs
 * it.
 *
 * `crypto.subtle.digest` offers SHA-1 and the SHA-2 family and rejects MD5
 * outright with a `NotSupportedError`, which is the correct decision for a
 * browser API: MD5's collision resistance has been broken since 2004 and no
 * new design should reach for it. A UUID version 3, though, is *defined* as
 * the MD5 of a namespace and a name, and reproducing an identifier some other
 * system already generated is not a new design — it is interoperability, and
 * getting a different answer would be the bug.
 *
 * So this is here, written out, in the manner of the CRC-32 in
 * `data/zip-archive` and the EXIF reader in `data/image-metadata`: a small,
 * pure, entirely tested function rather than a dependency. It is not exposed
 * as a general-purpose hash and nothing else in the site uses it.
 *
 * Never use it to protect anything. It is a fingerprint for a name, and the
 * only reason it exists here is that RFC 9562 says version 3 is spelled this
 * way.
 */

/** Per-round left-rotation amounts, in four groups of four. */
const shifts = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

/**
 * The per-round constants, which are `floor(2^32 × |sin(i + 1)|)`.
 *
 * Computed rather than tabulated: sixty-four magic numbers copied by hand are
 * sixty-four chances to mistype one, and a single wrong digit here produces a
 * hash that is wrong for every input while looking perfectly plausible.
 */
const constants = Uint32Array.from({ length: 64 }, (_, index) =>
  Math.floor(Math.abs(Math.sin(index + 1)) * 2 ** 32),
);

const rotateLeft = (value: number, by: number) => (value << by) | (value >>> (32 - by));

/** The MD5 digest of some bytes, as the sixteen bytes it is. */
export function md5(input: Uint8Array): Uint8Array<ArrayBuffer> {
  // The message is padded with a 1 bit, then zeros, then its own length in
  // bits as a 64-bit little-endian integer, to a multiple of 64 bytes.
  const padded = new Uint8Array((((input.length + 8) >> 6) + 1) << 6);

  padded.set(input);
  padded[input.length] = 0x80;

  const view = new DataView(padded.buffer);
  const bits = input.length * 8;

  view.setUint32(padded.length - 8, bits >>> 0, true);
  // A message long enough to need the high word cannot fit in a browser tab,
  // but writing it costs nothing and leaving it wrong would be a lie.
  view.setUint32(padded.length - 4, Math.floor(bits / 2 ** 32), true);

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;
  const block = new Uint32Array(16);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let word = 0; word < 16; word += 1) {
      block[word] = view.getUint32(offset + word * 4, true);
    }

    let [wa, wb, wc, wd] = [a, b, c, d];

    for (let step = 0; step < 64; step += 1) {
      let mixed: number;
      let index: number;

      if (step < 16) {
        mixed = (wb & wc) | (~wb & wd);
        index = step;
      } else if (step < 32) {
        mixed = (wd & wb) | (~wd & wc);
        index = (5 * step + 1) % 16;
      } else if (step < 48) {
        mixed = wb ^ wc ^ wd;
        index = (3 * step + 5) % 16;
      } else {
        mixed = wc ^ (wb | ~wd);
        index = (7 * step) % 16;
      }

      const rotated = rotateLeft((wa + mixed + constants[step] + block[index]) >>> 0, shifts[step]);

      [wa, wd, wc] = [wd, wc, wb];
      wb = (wb + rotated) >>> 0;
    }

    a = (a + wa) >>> 0;
    b = (b + wb) >>> 0;
    c = (c + wc) >>> 0;
    d = (d + wd) >>> 0;
  }

  const digest = new Uint8Array(16);
  const digestView = new DataView(digest.buffer);

  digestView.setUint32(0, a, true);
  digestView.setUint32(4, b, true);
  digestView.setUint32(8, c, true);
  digestView.setUint32(12, d, true);

  return digest;
}
