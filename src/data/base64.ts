/**
 * Base64, in both directions, over bytes.
 *
 * Written out rather than handed to `btoa` and `atob`, for three reasons that
 * all matter to a Gizlet whose whole job this is.
 *
 * `btoa` takes a string of code points below 256, so it throws on anything a
 * person actually types — an é, a curly quote, an emoji — and the usual
 * workaround is to encode UTF-8 by hand first anyway. `atob` has the opposite
 * problem: it is lenient, and quietly accepts input that is not valid Base64
 * rather than saying which character is wrong. And neither knows about the
 * URL-safe alphabet, which is half of what this Gizlet is for.
 *
 * So the alphabets, the padding, and the errors are all here, as pure
 * functions over `Uint8Array`, where they can be tested against RFC 4648's own
 * vectors. The browser is only asked for the two things it does well: reading
 * a file, and turning bytes into a download.
 *
 * Nothing here is encryption. Base64 is a way of writing bytes down using 64
 * characters that survive being emailed, and anyone can read it back — this
 * page reads it back. The page says so, because "encoded" is a word people
 * hear as "protected".
 */

/** The two alphabets of RFC 4648: the standard one, and the one safe in a URL. */
export const base64Alphabets = ['standard', 'url'] as const;

export type Base64Alphabet = (typeof base64Alphabets)[number];

const alphabetCharacters = {
  standard: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
  url: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
} as const satisfies Record<Base64Alphabet, string>;

export const base64AlphabetDetails = [
  {
    alphabet: 'standard',
    label: 'Standard',
    summary:
      "The original: the last two characters of the alphabet are + and /. What you want unless the result is going into a URL or a filename, where both of those characters mean something else.",
  },
  {
    alphabet: 'url',
    label: 'URL-safe',
    summary:
      'The same thing with - and _ in place of + and /, so the result can sit in a URL, a filename or a JWT without being escaped again. Usually written without padding as well.',
  },
] as const satisfies readonly { alphabet: Base64Alphabet; label: string; summary: string }[];

export const defaultBase64Alphabet: Base64Alphabet = 'standard';

export function isBase64Alphabet(value: string): value is Base64Alphabet {
  return (base64Alphabets as readonly string[]).includes(value);
}

export function getBase64AlphabetDetail(alphabet: Base64Alphabet) {
  return base64AlphabetDetails.find((detail) => detail.alphabet === alphabet) ?? base64AlphabetDetails[0];
}

/**
 * How large a file this turns into text.
 *
 * Base64 is four characters for every three bytes, so a file comes out a third
 * larger — and the result has to be held in the page, laid out, and selectable.
 * Half a megabyte in is about seven hundred thousand characters out, which is
 * already a great deal of text for a browser to render.
 */
export const maximumBase64FileBytes = 512 * 1024;

/** How much Base64 this will read back, which is the same limit from the far side. */
export const maximumBase64TextLength = 4 * 1024 * 1024;

export function validateBase64File(file: { readonly size: number }): string | undefined {
  if (file.size === 0) return 'That file is empty, so there is nothing to encode.';

  if (file.size > maximumBase64FileBytes) {
    return `That file is larger than this Gizlet turns into text. Base64 is a third larger than the bytes it describes, and the limit here is ${Math.round(maximumBase64FileBytes / 1024)} KB in.`;
  }

  return undefined;
}

/** The bytes of some text, which is what gets encoded. Always UTF-8. */
export function toUtf8(text: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(text);
}

/**
 * Some bytes read back as text, or nothing when they are not text at all.
 *
 * Nothing is a perfectly ordinary answer here: half of what people decode is a
 * PNG or a zip, and the honest response is to offer the bytes as a file rather
 * than to render replacement characters and call it text.
 */
export function fromUtf8(bytes: Uint8Array): string | undefined {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

export interface Base64EncodeOptions {
  readonly alphabet?: Base64Alphabet;
  /** Whether to write the `=` characters that pad the last group. */
  readonly padding?: boolean;
  /** Break the output every 76 characters, as MIME does. */
  readonly wrap?: boolean;
}

/** Where MIME breaks a line, and has since 1996. */
export const base64WrapColumn = 76;

export function encodeBase64(bytes: Uint8Array, options: Base64EncodeOptions = {}): string {
  const characters = alphabetCharacters[options.alphabet ?? defaultBase64Alphabet];
  const padded = options.padding ?? true;
  let output = '';

  for (let index = 0; index < bytes.length; index += 3) {
    // Three bytes are twenty-four bits, which is four groups of six.
    const remaining = Math.min(3, bytes.length - index);
    const group =
      (bytes[index] << 16) | ((remaining > 1 ? bytes[index + 1] : 0) << 8) | (remaining > 2 ? bytes[index + 2] : 0);

    output += characters[(group >> 18) & 0x3f];
    output += characters[(group >> 12) & 0x3f];
    // A group short of three bytes writes only the characters its bits reach,
    // and the padding — if any — stands in for the rest.
    output += remaining > 1 ? characters[(group >> 6) & 0x3f] : padded ? '=' : '';
    output += remaining > 2 ? characters[group & 0x3f] : padded ? '=' : '';
  }

  if (!options.wrap) return output;

  const lines: string[] = [];

  for (let index = 0; index < output.length; index += base64WrapColumn) {
    lines.push(output.slice(index, index + base64WrapColumn));
  }

  return lines.join('\n');
}

export interface Base64DecodeError {
  readonly message: string;
  /** Where in the cleaned-up input the trouble is, counted from zero. */
  readonly position?: number;
  readonly excerpt?: string;
}

export interface Base64Reading {
  readonly bytes: Uint8Array;
  /** Which alphabet the input turned out to be written in. */
  readonly alphabet: Base64Alphabet;
  readonly padded: boolean;
  /**
   * Whether the last group's unused bits were zero, as they are supposed to be.
   *
   * `QR==` and `QQ==` both decode to the single byte 0x41, because only the
   * first six bits of the second character are used — but only `QQ==` is the
   * canonical spelling. It is worth mentioning rather than refusing: the bytes
   * are unambiguous, and an encoder that does this is a broken encoder
   * somebody may want to know about.
   */
  readonly canonical: boolean;
  /** The media type, when the input was a data URI rather than bare Base64. */
  readonly mediaType?: string;
}

export type Base64DecodeResult =
  | { readonly ok: true; readonly reading: Base64Reading }
  | { readonly ok: false; readonly error: Base64DecodeError };

const dataUriPattern = /^data:([^;,]*)(;[^,]*)?,/i;

/**
 * The Base64 inside a data URI, and the media type it declared.
 *
 * People paste whole data URIs constantly — it is where Base64 is most often
 * seen — and refusing one because of its prefix would be a tool being pedantic
 * about the commonest input it will ever get.
 */
export function stripDataUri(text: string): { readonly body: string; readonly mediaType?: string } {
  const match = dataUriPattern.exec(text.trim());

  if (!match) return { body: text };

  const parameters = match[2] ?? '';

  if (!/;\s*base64/i.test(parameters)) {
    return { body: text };
  }

  return { body: text.trim().slice(match[0].length), mediaType: match[1] || 'text/plain' };
}

export function toDataUri(base64: string, mediaType: string): string {
  return `data:${mediaType || 'application/octet-stream'};base64,${base64.replace(/\n/g, '')}`;
}

/** Whitespace is legal between Base64 characters, and MIME puts it there. */
const stripWhitespace = (text: string) => text.replace(/\s+/g, '');

function detectAlphabet(text: string): Base64Alphabet | 'mixed' | 'none' {
  const standard = /[+/]/.test(text);
  const url = /[-_]/.test(text);

  if (standard && url) return 'mixed';
  if (url) return 'url';
  if (standard) return 'standard';

  // Nothing in it distinguishes the two, so either reading gives the same bytes.
  return 'none';
}

/**
 * Base64 read back into bytes.
 *
 * Deliberately generous about the shape of the input and strict about its
 * content: whitespace and line breaks are ignored, a data URI prefix is
 * understood, both alphabets are accepted and the one in use is reported, and
 * missing padding is fine. What is not fine is a character that is not in the
 * alphabet, or a length that no Base64 can have — and both are reported with
 * the position, because "invalid input" tells nobody anything.
 */
export function decodeBase64(input: string): Base64DecodeResult {
  if (input.trim() === '') {
    return { ok: false, error: { message: 'Paste some Base64 to read it back.' } };
  }

  if (input.length > maximumBase64TextLength) {
    return {
      ok: false,
      error: {
        message: `That is more Base64 than this Gizlet reads at once — the limit is ${Math.round(maximumBase64TextLength / (1024 * 1024))} MB of text.`,
      },
    };
  }

  const { body, mediaType } = stripDataUri(input);
  const text = stripWhitespace(body);

  if (text === '') {
    return { ok: false, error: { message: 'There is nothing after the data URI’s comma to read.' } };
  }

  const detected = detectAlphabet(text);

  if (detected === 'mixed') {
    return {
      ok: false,
      error: {
        message:
          'This mixes the two alphabets: it has + or / from the standard one and - or _ from the URL-safe one. One of them is a corruption, and guessing which would be a guess.',
      },
    };
  }

  const alphabet: Base64Alphabet = detected === 'none' ? defaultBase64Alphabet : detected;
  const characters = alphabetCharacters[alphabet];

  // Padding is the end of the string and nothing else, so it is checked as a
  // tail rather than character by character. Doing it in the scan below looked
  // reasonable and left two branches that could never fire: any character from
  // the other alphabet trips the mixed-alphabet check first, and an `=` that
  // passes a position test has, by definition, nothing after it.
  const paddingAt = text.indexOf('=');
  const padded = paddingAt !== -1;

  if (padded) {
    if (!/^={1,2}$/.test(text.slice(paddingAt))) {
      return {
        ok: false,
        error: {
          message:
            'The = characters are the very end of a Base64 string, and there are at most two of them. Something follows them here, so this is two pieces run together or a corrupted one.',
          position: paddingAt,
          excerpt: text.slice(Math.max(0, paddingAt - 4), paddingAt + 5),
        },
      };
    }

    // Padding exists to make the length a multiple of four. Padding that does
    // not achieve that is padding on something already truncated.
    if (text.length % 4 !== 0) {
      return {
        ok: false,
        error: {
          message: `Padded Base64 always comes in groups of four and this is ${text.length.toLocaleString()} characters long. The padding is there but part of the data is missing.`,
          position: text.length - 1,
        },
      };
    }
  }

  const data = padded ? text.slice(0, paddingAt) : text;
  const values: number[] = [];

  for (let index = 0; index < data.length; index += 1) {
    const character = data[index];
    const value = characters.indexOf(character);

    if (value === -1) {
      return {
        ok: false,
        error: {
          message: `${character} is not a Base64 character. The alphabet is A–Z, a–z, 0–9 and two more — ${alphabet === 'standard' ? '+ and /' : '- and _'} — plus = for padding.`,
          position: index,
          excerpt: data.slice(Math.max(0, index - 4), index + 5),
        },
      };
    }

    values.push(value);
  }

  // Every three bytes is four characters, so a remainder of one character is a
  // length no encoder can produce: six bits is not enough for a byte.
  if (values.length % 4 === 1) {
    return {
      ok: false,
      error: {
        message:
          'This is one character too long or three too short: Base64 comes in groups of four, and a group of one holds no whole byte. Something has been truncated.',
        position: values.length - 1,
      },
    };
  }

  const bytes = new Uint8Array(Math.floor((values.length * 6) / 8));
  let byte = 0;
  let bits = 0;
  let written = 0;

  for (const value of values) {
    byte = (byte << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes[written] = (byte >> bits) & 0xff;
      written += 1;
    }
  }

  // Whatever is left over is the last character's unused low bits, and a
  // canonical encoder leaves them zero.
  const canonical = bits === 0 || ((byte << (8 - bits)) & 0xff) === 0;

  return { ok: true, reading: { bytes, alphabet, padded, canonical, ...(mediaType ? { mediaType } : {}) } };
}

/** Where a decoding error is, said the way a person counts. */
export function describeBase64Error(error: Base64DecodeError): string {
  if (error.position === undefined) return error.message;

  const where = `Character ${(error.position + 1).toLocaleString()}`;

  return error.excerpt ? `${where}, near ${error.excerpt}: ${error.message}` : `${where}: ${error.message}`;
}

/** What the page says about Base64 it has just read. */
export function describeBase64Reading(
  reading: Base64Reading,
  formatSize: (bytes: number) => string,
): string {
  const parts = [
    `${formatSize(reading.bytes.length)} of data`,
    reading.alphabet === 'url' ? 'URL-safe alphabet' : 'standard alphabet',
    reading.padded ? 'padded' : 'no padding',
  ];

  if (reading.mediaType) parts.push(`declared as ${reading.mediaType}`);

  if (!reading.canonical) {
    parts.push('non-canonical: the last character has bits set that should be zero');
  }

  return parts.join(' · ');
}

/** What the page says about text or a file it has just encoded. */
export function describeBase64Output(
  inputBytes: number,
  outputLength: number,
  formatSize: (bytes: number) => string,
): string {
  const growth = inputBytes === 0 ? 0 : Math.round(((outputLength - inputBytes) / inputBytes) * 100);

  return `${formatSize(inputBytes)} in · ${outputLength.toLocaleString()} characters out · ${growth}% larger`;
}

/**
 * A filename for bytes that came out of Base64.
 *
 * Named after the media type when the input was a data URI and said what it
 * was, because that is the one case where the bytes announce their own kind.
 */
export function getBase64DownloadName(mediaType?: string): string {
  const extensions: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'application/pdf': 'pdf',
    'application/zip': 'zip',
    'application/json': 'json',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'text/html': 'html',
  };
  const extension = mediaType ? extensions[mediaType.toLowerCase()] : undefined;

  return `decoded.${extension ?? 'bin'}`;
}

export function getBase64NotTextMessage(): string {
  return 'These bytes are not text — they decode to something else, a picture or an archive most likely. Download them as a file instead; nothing is lost.';
}

/** Base64 is not a disguise, and the page has to say so somewhere. */
export function getBase64NotEncryptionNote(): string {
  return 'Base64 is a way of writing bytes down, not a way of hiding them. Anyone can read it back — this page reads it back — so it protects nothing.';
}
