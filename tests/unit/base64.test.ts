import { describe, expect, it } from 'vitest';

import {
  base64AlphabetDetails,
  base64Alphabets,
  base64WrapColumn,
  decodeBase64,
  defaultBase64Alphabet,
  describeBase64Error,
  describeBase64Output,
  describeBase64Reading,
  encodeBase64,
  fromUtf8,
  getBase64AlphabetDetail,
  getBase64DownloadName,
  getBase64NotEncryptionNote,
  getBase64NotTextMessage,
  isBase64Alphabet,
  maximumBase64FileBytes,
  stripDataUri,
  toDataUri,
  toUtf8,
  validateBase64File,
} from '../../src/data/base64';

const formatSize = (bytes: number) => `${bytes} B`;
const encodeText = (text: string, options = {}) => encodeBase64(toUtf8(text), options);

/** Decoded back to text, for the cases where the answer is text. */
const decodeText = (input: string) => {
  const result = decodeBase64(input);

  return result.ok ? fromUtf8(result.reading.bytes) : undefined;
};

/** The reading, insisting it succeeded, so the assertions stay readable. */
const readingOf = (input: string) => {
  const result = decodeBase64(input);

  if (!result.ok) throw new Error(`Expected ${input} to decode: ${result.error.message}`);

  return result.reading;
};

/** The error, insisting it failed, for the same reason. */
const errorOf = (input: string) => {
  const result = decodeBase64(input);

  if (result.ok) throw new Error(`Expected ${input} not to decode.`);

  return result.error;
};

describe('the two alphabets', () => {
  it('describes both, and offers both', () => {
    expect(base64AlphabetDetails.map((detail) => detail.alphabet)).toEqual([...base64Alphabets]);
    expect(base64Alphabets).toContain(defaultBase64Alphabet);
    expect(isBase64Alphabet('url')).toBe(true);
    expect(isBase64Alphabet('base64url')).toBe(false);
    expect(getBase64AlphabetDetail('url').label).toBe('URL-safe');

    for (const detail of base64AlphabetDetails) {
      expect(detail.summary.length, detail.alphabet).toBeGreaterThan(60);
    }
  });

  it('differs only in the last two characters', () => {
    // 0xfb 0xff produces both of the characters that distinguish them.
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf]);

    expect(encodeBase64(bytes, { alphabet: 'standard' })).toBe('+/+/');
    expect(encodeBase64(bytes, { alphabet: 'url' })).toBe('-_-_');
  });
});

describe('encoding', () => {
  /**
   * The test vectors from section 10 of RFC 4648, which exist precisely
   * because the padding of the last group is the part everyone gets wrong.
   */
  it('matches every vector in RFC 4648', () => {
    expect(encodeText('')).toBe('');
    expect(encodeText('f')).toBe('Zg==');
    expect(encodeText('fo')).toBe('Zm8=');
    expect(encodeText('foo')).toBe('Zm9v');
    expect(encodeText('foob')).toBe('Zm9vYg==');
    expect(encodeText('fooba')).toBe('Zm9vYmE=');
    expect(encodeText('foobar')).toBe('Zm9vYmFy');
  });

  it('leaves the padding off when asked, without changing the characters', () => {
    expect(encodeText('f', { padding: false })).toBe('Zg');
    expect(encodeText('fo', { padding: false })).toBe('Zm8');
    expect(encodeText('foo', { padding: false })).toBe('Zm9v');
    // Unpadded and padded read back to the same bytes, which is the point.
    expect(decodeText('Zg')).toBe('f');
    expect(decodeText('Zg==')).toBe('f');
  });

  it('encodes text as its UTF-8 bytes, which btoa cannot do at all', () => {
    // Every one of these would throw out of btoa.
    expect(encodeText('é')).toBe('w6k=');
    expect(encodeText('👍')).toBe('8J+RjQ==');
    expect(encodeText('日本語')).toBe('5pel5pys6Kqe');
    expect(decodeText(encodeText('naïve café 日本語 👍'))).toBe('naïve café 日本語 👍');
  });

  it('wraps at the column MIME wraps at, when asked', () => {
    const long = encodeBase64(new Uint8Array(200).fill(0x41), { wrap: true });
    const lines = long.split('\n');

    expect(lines[0]).toHaveLength(base64WrapColumn);
    expect(base64WrapColumn).toBe(76);
    expect(lines.length).toBeGreaterThan(1);
    // Wrapping changes nothing about what it decodes to.
    expect(decodeBase64(long).ok).toBe(true);
    expect(readingOf(long).bytes).toHaveLength(200);
  });

  it('encodes a zero byte rather than treating it as the end', () => {
    expect(encodeBase64(new Uint8Array([0, 0, 0]))).toBe('AAAA');
    expect(encodeBase64(new Uint8Array([0]))).toBe('AA==');
  });

  it('encodes every byte value without losing one', () => {
    const all = Uint8Array.from({ length: 256 }, (_, index) => index);
    const result = decodeBase64(encodeBase64(all));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([...result.reading.bytes]).toEqual([...all]);
  });
});

describe('decoding', () => {
  it('reads back every vector in RFC 4648', () => {
    expect(decodeText('')).toBeUndefined();
    expect(decodeText('Zg==')).toBe('f');
    expect(decodeText('Zm8=')).toBe('fo');
    expect(decodeText('Zm9v')).toBe('foo');
    expect(decodeText('Zm9vYg==')).toBe('foob');
    expect(decodeText('Zm9vYmE=')).toBe('fooba');
    expect(decodeText('Zm9vYmFy')).toBe('foobar');
  });

  it('ignores whitespace and line breaks, as MIME requires', () => {
    expect(decodeText('Zm9v YmFy')).toBe('foobar');
    expect(decodeText('Zm9v\nYmFy')).toBe('foobar');
    expect(decodeText('  Zm9vYmFy\r\n  ')).toBe('foobar');
  });

  it('says which alphabet it found, and reads both', () => {
    const standard = decodeBase64('+/+/');
    const url = decodeBase64('-_-_');

    expect(standard.ok && standard.reading.alphabet).toBe('standard');
    expect(url.ok && url.reading.alphabet).toBe('url');
    expect(standard.ok && url.ok && [...standard.reading.bytes]).toEqual(
      url.ok ? [...url.reading.bytes] : [],
    );
  });

  it('assumes the standard alphabet when nothing distinguishes them', () => {
    const result = decodeBase64('Zm9vYmFy');

    expect(result.ok && result.reading.alphabet).toBe('standard');
  });

  it('reports whether the input was padded', () => {
    expect(readingOf('Zg==').padded).toBe(true);
    expect(readingOf('Zg').padded).toBe(false);
  });

  it('refuses input that mixes the two alphabets rather than guessing', () => {
    const result = decodeBase64('ab+cd_ef');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('mixes the two alphabets');
  });

  it('names the character that is not Base64, and where it is', () => {
    const result = decodeBase64('Zm9v*mFy');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.position).toBe(4);
    expect(result.error.message).toContain('* is not a Base64 character');
    expect(describeBase64Error(result.error)).toContain('Character 5');
  });

  it('refuses anything after the padding, wherever the padding starts', () => {
    // Padding in the middle, and two whole strings run together, are the same
    // fault seen from two angles: something follows the =.
    for (const [input, position] of [
      ['Zm9=YmFy', 3],
      ['Zg==Zg==', 2],
      ['Zg=A', 2],
      ['Zg===', 2],
    ] as const) {
      const result = decodeBase64(input);

      expect(result.ok, input).toBe(false);
      if (result.ok) continue;
      expect(result.error.message, input).toContain('very end of a Base64 string');
      expect(result.error.position, input).toBe(position);
    }
  });

  it('refuses padding on something already truncated', () => {
    // Padding exists to bring the length to a multiple of four, so padding
    // that does not is padding over missing data.
    const result = decodeBase64('Zg=');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('groups of four');
    expect(result.error.message).toContain('3 characters long');
  });

  it('refuses a length no encoder can produce', () => {
    const result = decodeBase64('Zm9vY');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('groups of four');
    // Four characters is a whole group, five is a group and an orphan.
    expect(decodeBase64('Zm9v').ok).toBe(true);
    expect(decodeBase64('Zm9vYQ').ok).toBe(true);
  });

  it('asks for something when given nothing', () => {
    expect(decodeBase64('').ok).toBe(false);
    expect(decodeBase64('   ').ok).toBe(false);
    expect(errorOf('').message).toContain('Paste some');
  });

  it('notices a non-canonical spelling without refusing it', () => {
    // QQ== and QR== both decode to 0x41, because only six of the second
    // character's bits are used — but only QQ== leaves the rest zero.
    expect(readingOf('QQ==').canonical).toBe(true);
    expect(readingOf('QR==').canonical).toBe(false);
    // The bytes are the same either way, which is why this is a note and not
    // an error.
    expect([...readingOf('QR==').bytes]).toEqual([0x41]);
    expect(describeBase64Reading(readingOf('QR=='), formatSize)).toContain('non-canonical');
  });

  it('refuses more text than it will read at once', () => {
    const result = decodeBase64('A'.repeat(4 * 1024 * 1024 + 4));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('MB of text');
  });
});

describe('bytes that are not text', () => {
  it('says so rather than rendering nonsense', () => {
    // 0xff 0xfe is not valid UTF-8 at all.
    const result = decodeBase64(encodeBase64(new Uint8Array([0xff, 0xfe, 0x00])));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(fromUtf8(result.reading.bytes)).toBeUndefined();
    expect(getBase64NotTextMessage()).toContain('Download them as a file');
  });

  it('reads text back when it is text', () => {
    expect(fromUtf8(toUtf8('ordinary'))).toBe('ordinary');
    expect(fromUtf8(new Uint8Array())).toBe('');
  });
});

describe('a data URI, which is where Base64 is usually seen', () => {
  it('reads the Base64 out of one, and the media type with it', () => {
    const result = decodeBase64('data:image/png;base64,Zm9vYmFy');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(fromUtf8(result.reading.bytes)).toBe('foobar');
    expect(result.reading.mediaType).toBe('image/png');
  });

  it('handles one with no media type, and one with parameters', () => {
    expect(stripDataUri('data:;base64,Zg==').mediaType).toBe('text/plain');
    expect(stripDataUri('data:text/plain;charset=utf-8;base64,Zg==').mediaType).toBe('text/plain');
  });

  it('leaves a URI that is not Base64 alone', () => {
    // A data URI without ;base64 holds percent-encoded text, not Base64.
    expect(stripDataUri('data:text/plain,hello').mediaType).toBeUndefined();
    expect(stripDataUri('Zm9vYmFy').body).toBe('Zm9vYmFy');
  });

  it('says when there is nothing after the comma', () => {
    const result = decodeBase64('data:image/png;base64,');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('nothing after the data URI');
  });

  it('writes one, with a fallback type for bytes of unknown kind', () => {
    expect(toDataUri('Zm9v', 'image/png')).toBe('data:image/png;base64,Zm9v');
    expect(toDataUri('Zm9v', '')).toBe('data:application/octet-stream;base64,Zm9v');
    // A wrapped encoding has to lose its line breaks to be a URI.
    expect(toDataUri('Zm9v\nYmFy', 'text/plain')).toBe('data:text/plain;base64,Zm9vYmFy');
  });

  it('names the download after the type the URI declared', () => {
    expect(getBase64DownloadName('image/png')).toBe('decoded.png');
    expect(getBase64DownloadName('application/pdf')).toBe('decoded.pdf');
    expect(getBase64DownloadName('IMAGE/JPEG')).toBe('decoded.jpg');
    expect(getBase64DownloadName('application/x-thing')).toBe('decoded.bin');
    expect(getBase64DownloadName()).toBe('decoded.bin');
  });
});

describe('the file a visitor chose', () => {
  it('refuses an empty file and one too large to become text', () => {
    expect(validateBase64File({ size: 0 })).toContain('empty');
    expect(validateBase64File({ size: maximumBase64FileBytes + 1 })).toContain('larger than');
    expect(validateBase64File({ size: maximumBase64FileBytes })).toBeUndefined();
    expect(validateBase64File({ size: 1_024 })).toBeUndefined();
  });
});

describe('what the page says', () => {
  it('describes what came out, and how much larger it got', () => {
    expect(describeBase64Output(3, 4, formatSize)).toBe('3 B in · 4 characters out · 33% larger');
    expect(describeBase64Output(0, 0, formatSize)).toContain('0% larger');
  });

  it('describes what was read back', () => {
    const result = decodeBase64('data:image/png;base64,Zm9vYmFy');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const said = describeBase64Reading(result.reading, formatSize);

    expect(said).toContain('6 B of data');
    expect(said).toContain('standard alphabet');
    expect(said).toContain('no padding');
    expect(said).toContain('declared as image/png');
  });

  it('never lets the page imply Base64 protects anything', () => {
    expect(getBase64NotEncryptionNote()).toContain('not a way of hiding them');
  });
});
