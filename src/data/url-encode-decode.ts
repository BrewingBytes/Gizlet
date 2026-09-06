/**
 * Percent-encoding, in both directions.
 *
 * The whole of this Gizlet is here, because the whole of it is a function over
 * a string. What makes it worth writing down rather than reaching for one line
 * of `encodeURIComponent` is that there is no such thing as "the" URL encoding:
 * there are three in daily use, they disagree about characters people actually
 * type, and a tool that silently picks one is how a `&` ends up splitting a
 * query string in half at three in the morning.
 *
 * The other half is decoding, where the browser's own function throws one
 * `URIError` with nothing in it for every kind of broken input. A person
 * looking at 400 characters of percent-encoded text needs to be told which
 * character is the problem, so the input is walked here and the position is
 * reported — including for the case the syntax is perfectly good and the bytes
 * underneath are not a character at all.
 */

/** The three encodings, which differ in what they consider safe to leave alone. */
export const urlEncodingModes = ['component', 'url', 'form'] as const;

export type UrlEncodingMode = (typeof urlEncodingModes)[number];

export interface UrlEncodingModeDetail {
  readonly mode: UrlEncodingMode;
  readonly label: string;
  /** What this one is for, in the words of the job rather than of the standard. */
  readonly summary: string;
}

export const urlEncodingModeDetails = [
  {
    mode: 'component',
    label: 'One piece of a URL',
    summary:
      'A value going inside a URL: a query parameter, a path segment, a fragment. Everything with a job in a URL is escaped, so a & or a / in your text stays part of your text.',
  },
  {
    mode: 'url',
    label: 'A whole URL',
    summary:
      'A complete address that is already assembled. The characters that structure a URL — : / ? # & = — are left alone, because here they are doing their job; only what would break the address is escaped.',
  },
  {
    mode: 'form',
    label: 'A form field',
    summary:
      'What a browser sends when a form is submitted, and what a query string usually holds in practice: a space becomes a plus rather than %20, and a few more characters are escaped than strictly need to be.',
  },
] as const satisfies readonly UrlEncodingModeDetail[];

export const defaultUrlEncodingMode: UrlEncodingMode = 'component';

/** Whether a mode is one this Gizlet knows, for a value that came from a link. */
export function isUrlEncodingMode(value: string): value is UrlEncodingMode {
  return (urlEncodingModes as readonly string[]).includes(value);
}

export function getUrlEncodingModeDetail(mode: UrlEncodingMode): UrlEncodingModeDetail {
  return urlEncodingModeDetails.find((detail) => detail.mode === mode) ?? urlEncodingModeDetails[0];
}

/** The two directions. A Gizlet that only went one way would be half a Gizlet. */
export const urlEncodingDirections = ['encode', 'decode'] as const;

export type UrlEncodingDirection = (typeof urlEncodingDirections)[number];

export function isUrlEncodingDirection(value: string): value is UrlEncodingDirection {
  return (urlEncodingDirections as readonly string[]).includes(value);
}

const escapeOf = (character: string) =>
  `%${character.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`;

/**
 * The text, percent-encoded the way the chosen mode encodes it.
 *
 * The first two are the browser's own functions, which is the point: they are
 * the definition of what a URL means to the thing that will read it back, and
 * reimplementing them here would be a second opinion nobody asked for.
 *
 * Form encoding is the one the browser does not expose as a function over a
 * string. It is the component encoding with the four characters `!'()` and a
 * tilde escaped as well, and a space written as a plus — which is exactly what
 * `URLSearchParams` produces, arrived at without building a parameter list to
 * throw away.
 */
export function encodeUrlText(input: string, mode: UrlEncodingMode): string {
  if (mode === 'url') return encodeURI(input);

  const component = encodeURIComponent(input);

  if (mode === 'component') return component;

  return component.replace(/[!'()~]/g, escapeOf).replace(/%20/g, '+');
}

export interface UrlDecodeError {
  readonly message: string;
  /** Where in the input the trouble starts, counted in characters from zero. */
  readonly position: number;
  /** The offending text itself, short enough to put in a sentence. */
  readonly excerpt: string;
}

export type UrlDecodeResult =
  | { readonly ok: true; readonly output: string }
  | { readonly ok: false; readonly error: UrlDecodeError };

const hexDigits = /^[0-9A-Fa-f]{2}$/;

/**
 * How many bytes a UTF-8 sequence starting with this one has, and what its
 * second byte is allowed to be.
 *
 * The narrowed ranges are not pedantry. `E0` followed by anything below `A0`
 * is an overlong encoding — a character written in more bytes than it needs,
 * which is how a `/` has historically been smuggled past a filter that was
 * looking for `/`. `ED` above `9F` is half of a surrogate pair, which is not a
 * character at all. Both are invalid UTF-8, and both decode "successfully" in
 * an implementation that only counts bytes.
 */
function leadByte(byte: number): { readonly length: number; readonly low: number; readonly high: number } | undefined {
  if (byte < 0x80) return { length: 1, low: 0, high: 0 };
  if (byte >= 0xc2 && byte <= 0xdf) return { length: 2, low: 0x80, high: 0xbf };
  if (byte === 0xe0) return { length: 3, low: 0xa0, high: 0xbf };
  if (byte === 0xed) return { length: 3, low: 0x80, high: 0x9f };
  if (byte >= 0xe1 && byte <= 0xef) return { length: 3, low: 0x80, high: 0xbf };
  if (byte === 0xf0) return { length: 4, low: 0x90, high: 0xbf };
  if (byte === 0xf4) return { length: 4, low: 0x80, high: 0x8f };
  if (byte >= 0xf1 && byte <= 0xf3) return { length: 4, low: 0x80, high: 0xbf };

  return undefined;
}

interface Escape {
  /** Where the `%` is in the input. */
  readonly at: number;
  readonly byte: number;
}

/** The bytes of one unbroken run of escapes, checked as a UTF-8 sequence. */
function checkRun(run: readonly Escape[]): UrlDecodeError | undefined {
  let index = 0;

  while (index < run.length) {
    const start = run[index];
    const lead = leadByte(start.byte);

    if (!lead) {
      return {
        message: `The byte ${escapeOf(String.fromCharCode(start.byte))} cannot begin a character in UTF-8, which is the encoding a URL's escapes stand for.`,
        position: start.at,
        excerpt: escapeOf(String.fromCharCode(start.byte)),
      };
    }

    const sequence = run.slice(index, index + lead.length);

    if (sequence.length < lead.length) {
      return {
        message: `The escape sequence beginning here needs ${lead.length} bytes to make one character and only ${sequence.length} ${sequence.length === 1 ? 'was' : 'were'} given.`,
        position: start.at,
        excerpt: sequence.map((escape) => escapeOf(String.fromCharCode(escape.byte))).join(''),
      };
    }

    for (const [offset, escape] of sequence.slice(1).entries()) {
      const low = offset === 0 ? lead.low : 0x80;
      const high = offset === 0 ? lead.high : 0xbf;

      if (escape.byte < low || escape.byte > high) {
        return {
          message: 'These bytes are not a character in UTF-8. They may have been encoded twice, or in a different encoding altogether.',
          position: start.at,
          excerpt: sequence.map((item) => escapeOf(String.fromCharCode(item.byte))).join(''),
        };
      }
    }

    index += lead.length;
  }

  return undefined;
}

/**
 * The first thing wrong with the escapes in some text, or nothing.
 *
 * Walked by hand rather than by catching the browser's `URIError`, which says
 * only "URI malformed" and never where. Somebody staring at a wall of
 * percent-encoded text is asking exactly one question, and it is where.
 */
export function findUrlDecodeError(input: string): UrlDecodeError | undefined {
  let run: Escape[] = [];

  for (let index = 0; index < input.length; index += 1) {
    if (input[index] !== '%') {
      const problem = run.length > 0 ? checkRun(run) : undefined;

      if (problem) return problem;

      run = [];
      continue;
    }

    const digits = input.slice(index + 1, index + 3);

    if (digits.length < 2) {
      return {
        message: 'A % here is the start of an escape and the text ends before it finishes. An escape is a % and two hexadecimal digits, as in %20.',
        position: index,
        excerpt: input.slice(index),
      };
    }

    if (!hexDigits.test(digits)) {
      return {
        message: `A % must be followed by two hexadecimal digits — 0 to 9 and A to F — and this one is followed by ${digits}. A % that is meant to be a per-cent sign is written %25.`,
        position: index,
        excerpt: input.slice(index, index + 3),
      };
    }

    run.push({ at: index, byte: Number.parseInt(digits, 16) });
    index += 2;
  }

  return run.length > 0 ? checkRun(run) : undefined;
}

/**
 * The text, read back.
 *
 * A plus is a space only where a plus means a space. In a form field it does;
 * in a path segment it is a plus, and a Gizlet that turned every plus into a
 * space would quietly corrupt every base64 string it was ever given.
 */
export function decodeUrlText(input: string, mode: UrlEncodingMode): UrlDecodeResult {
  const prepared = mode === 'form' ? input.replace(/\+/g, ' ') : input;
  const problem = findUrlDecodeError(prepared);

  if (problem) return { ok: false, error: problem };

  try {
    return { ok: true, output: decodeURIComponent(prepared) };
  } catch {
    // Belt and braces: the walk above should have found anything this catches.
    return {
      ok: false,
      error: {
        message: 'This text could not be read back. Some of its escapes do not stand for characters.',
        position: 0,
        excerpt: prepared.slice(0, 24),
      },
    };
  }
}

export type UrlConversionResult =
  | { readonly ok: true; readonly output: string }
  | { readonly ok: false; readonly error: UrlDecodeError };

/** One entry point, so the page holds a direction rather than two code paths. */
export function convertUrlText(
  input: string,
  direction: UrlEncodingDirection,
  mode: UrlEncodingMode,
): UrlConversionResult {
  return direction === 'encode' ? { ok: true, output: encodeUrlText(input, mode) } : decodeUrlText(input, mode);
}

/** Where an error is, said the way a person counts rather than the way an array does. */
export function describeUrlDecodeError(error: UrlDecodeError): string {
  return `Character ${(error.position + 1).toLocaleString()}, ${error.excerpt}: ${error.message}`;
}

/**
 * What the conversion did, which is worth saying when it looks like nothing.
 *
 * Text with nothing in it that needs escaping comes back identical, and a
 * person who pasted something and saw no change deserves to be told that the
 * answer is the same as the question rather than left wondering.
 *
 * The count is of characters rather than of escapes, because one character
 * outside ASCII is several bytes and so several escapes: reporting "four
 * characters were escaped" for one emoji would be arithmetic that is true
 * about bytes and false about what the visitor is looking at.
 */
export function describeUrlConversion(
  input: string,
  output: string,
  direction: UrlEncodingDirection,
  mode: UrlEncodingMode,
): string {
  if (input === '') return 'Type or paste something above.';

  if (input === output) {
    return direction === 'encode'
      ? 'Nothing here needed escaping, so this is the text unchanged.'
      : 'There were no escapes to read back, so this is the text unchanged.';
  }

  if (direction === 'encode') {
    const changed = [...input].filter((character) => encodeUrlText(character, mode) !== character).length;

    return `${changed.toLocaleString()} ${changed === 1 ? 'character was' : 'characters were'} escaped.`;
  }

  const escapes = (input.match(/%[0-9A-Fa-f]{2}/g) ?? []).length;
  const pluses = mode === 'form' ? input.length - input.replace(/\+/g, '').length : 0;
  const read = escapes + pluses;

  return `${read.toLocaleString()} ${read === 1 ? 'escape was' : 'escapes were'} read back.`;
}
