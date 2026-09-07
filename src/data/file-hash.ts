import { md5 } from './md5';

/**
 * A file's digest, and a digest somebody published, compared.
 *
 * These are one job rather than two. Computing a hash and checking one are the
 * same arithmetic over the same bytes, and the only difference is whether you
 * arrived with a number to compare against — so the expected hash is an extra
 * field on this page rather than a second Gizlet with its own route.
 *
 * The algorithm is never asked for. A published checksum is a run of
 * hexadecimal and its length says which digest made it, so a pasted hash
 * identifies itself: 32 characters is MD5, 40 is SHA-1, 64 is SHA-256, 96 is
 * SHA-384, 128 is SHA-512. A dropdown asking a visitor to name the algorithm
 * of a string they just copied is a dropdown asking them to count characters.
 *
 * MD5 and SHA-1 are here despite being broken, and labelled as broken. Neither
 * should be relied on to prove a file was not tampered with — a collision can
 * be produced deliberately, which is exactly the attack a checksum is supposed
 * to notice. They are read anyway because a great many published checksums
 * still are one of the two, and refusing to compute one would mean refusing to
 * answer the question a visitor actually has.
 *
 * The digest itself is the platform's, except for MD5, which the platform
 * refuses to provide: `crypto.subtle` rejects it outright, so `data/md5.ts` —
 * written for the UUID versions that are defined in terms of it — is the MD5
 * this page uses too.
 */

/**
 * The digests this page computes, in the order it shows them.
 *
 * SHA-256 first because it is what nearly every project publishes, and the
 * broken pair last, after the ones a reader should prefer.
 */
export const hashAlgorithms = ['sha256', 'sha512', 'sha384', 'sha1', 'md5'] as const;

export type HashAlgorithm = (typeof hashAlgorithms)[number];

export interface HashAlgorithmDetail {
  readonly id: HashAlgorithm;
  readonly label: string;
  /** How many hexadecimal characters the digest is written in. */
  readonly hexLength: number;
  /**
   * The name `crypto.subtle.digest` knows it by, for the four it will do.
   * MD5 has none, which is the whole reason `data/md5.ts` exists.
   */
  readonly subtleName?: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';
  /**
   * Broken for authenticity: two different files with the same digest can be
   * produced on purpose, so a match proves the bytes were not damaged and
   * nothing about whether they were tampered with.
   */
  readonly broken?: true;
  readonly meaning: string;
}

export const hashAlgorithmDetails: readonly HashAlgorithmDetail[] = [
  {
    id: 'sha256',
    label: 'SHA-256',
    hexLength: 64,
    subtleName: 'SHA-256',
    meaning:
      'The one to use, and the one almost every project publishes. If a download offers a single checksum, this is usually it.',
  },
  {
    id: 'sha512',
    label: 'SHA-512',
    hexLength: 128,
    subtleName: 'SHA-512',
    meaning:
      'The same family with a longer digest. No weaker than SHA-256 and no stronger in any way that matters here; it is published because some projects prefer it.',
  },
  {
    id: 'sha384',
    label: 'SHA-384',
    hexLength: 96,
    subtleName: 'SHA-384',
    meaning:
      'SHA-512 cut short. Rarely published for a download, and here so that a 96-character hash somebody hands you can be checked rather than only named.',
  },
  {
    id: 'sha1',
    label: 'SHA-1',
    hexLength: 40,
    subtleName: 'SHA-1',
    broken: true,
    meaning:
      'Broken for authenticity since 2017: a pair of files with the same SHA-1 can be produced on purpose. Still everywhere — git names commits with it, and older release pages publish it — so it is computed and labelled rather than left out.',
  },
  {
    id: 'md5',
    label: 'MD5',
    hexLength: 32,
    broken: true,
    meaning:
      'Broken for authenticity since 2004, and thoroughly: a collision takes seconds on a laptop. It survives as a way to notice a damaged transfer, and on a great many release pages, so it is computed and labelled rather than left out.',
  },
];

export function isHashAlgorithm(value: string): value is HashAlgorithm {
  return hashAlgorithms.includes(value as HashAlgorithm);
}

export function getHashAlgorithm(id: HashAlgorithm): HashAlgorithmDetail {
  const detail = hashAlgorithmDetails.find((candidate) => candidate.id === id);

  if (!detail) throw new Error(`Missing hash algorithm: ${id}`);

  return detail;
}

/** Which digest writes a hash this long, which is how a pasted one is read. */
export function getHashAlgorithmForHexLength(length: number): HashAlgorithm | undefined {
  return hashAlgorithmDetails.find((detail) => detail.hexLength === length)?.id;
}

/** The lengths a hash can be, said in the order a reader meets them. */
export function describeHashLengths(): string {
  return hashAlgorithmDetails
    .map((detail) => detail.hexLength)
    .sort((first, second) => first - second)
    .map((length) => String(length))
    .join(', ');
}

/**
 * How much file this reads at once.
 *
 * `crypto.subtle.digest` has no streaming form — it takes the whole message as
 * one buffer — so a file has to fit in the tab to be hashed here at all. The
 * ceiling is about a browser tab rather than about the digests, which have
 * none, and it is the same one the archive Gizlets keep.
 */
export const maximumHashBytes = 512 * 1024 * 1024;

/**
 * MD5's own, lower ceiling.
 *
 * It is the one digest written out in this project rather than provided by the
 * browser, and it pads a copy of the message before it starts, so it wants
 * twice the file in memory and runs in JavaScript on the page's own thread.
 * A file above this gets its four SHA digests and an MD5 row that says why it
 * is empty, which is a better answer than a tab that stops responding.
 */
export const maximumMd5Bytes = 128 * 1024 * 1024;

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024)).toLocaleString()} MB`;
}

export function validateHashFile(file: { readonly size: number }): string | undefined {
  if (file.size > maximumHashBytes) {
    return `That file is larger than the ${formatMegabytes(maximumHashBytes)} this page can hash. The browser’s own digest takes the whole file at once rather than a piece at a time, so it has to fit in this tab.`;
  }

  return undefined;
}

/**
 * An empty file is hashed rather than refused.
 *
 * A download that failed outright is nought bytes, and telling somebody their
 * checksum does not match is the answer they came for. What is worth saying is
 * that the digest below is not about their file: every empty file has it.
 */
export function getHashFileNote(file: { readonly size: number }): string | undefined {
  if (file.size > 0) return undefined;

  return 'That file is empty. The digests below are the digests of nothing at all — every empty file has them — which is itself worth knowing if you expected a download.';
}

/** The digests a file this size does not get, with MD5 the only one there is. */
export function getSkippedHashAlgorithms(byteLength: number): readonly HashAlgorithm[] {
  return byteLength > maximumMd5Bytes ? ['md5'] : [];
}

export function describeSkippedHashAlgorithm(algorithm: HashAlgorithm): string {
  return `Not computed. ${getHashAlgorithm(algorithm).label} is written out in this page rather than provided by the browser, and above ${formatMegabytes(maximumMd5Bytes)} it would want twice the file in memory and hold up the page while it worked.`;
}

/** The digests actually computed for a file this size, in reading order. */
export function getHashAlgorithmsForSize(byteLength: number): readonly HashAlgorithm[] {
  const skipped = getSkippedHashAlgorithms(byteLength);

  return hashAlgorithms.filter((algorithm) => !skipped.includes(algorithm));
}

/** Bytes as the lowercase hexadecimal every checksum file is written in. */
export function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The one thing hashing cannot do by itself: the platform's digest.
 *
 * It is passed in rather than reached for, so this module stays a pure
 * function of its input and the unit tests can hash a known vector and check
 * the answer, in the manner of `data/uuid.ts` and its randomness.
 */
export type DigestFunction = (
  subtleName: string,
  bytes: Uint8Array<ArrayBuffer>,
) => Promise<ArrayBuffer>;

export interface FileDigest {
  readonly algorithm: HashAlgorithm;
  readonly hex: string;
}

export async function hashBytesWith(
  algorithm: HashAlgorithm,
  bytes: Uint8Array<ArrayBuffer>,
  digest: DigestFunction,
): Promise<string> {
  const { subtleName } = getHashAlgorithm(algorithm);

  if (!subtleName) return toHex(md5(bytes));

  return toHex(new Uint8Array(await digest(subtleName, bytes)));
}

/** Every digest a file this size gets, in the order the page shows them. */
export async function hashBytes(
  bytes: Uint8Array<ArrayBuffer>,
  digest: DigestFunction,
  algorithms: readonly HashAlgorithm[] = getHashAlgorithmsForSize(bytes.length),
): Promise<readonly FileDigest[]> {
  const digests: FileDigest[] = [];

  for (const algorithm of algorithms) {
    digests.push({ algorithm, hex: await hashBytesWith(algorithm, bytes, digest) });
  }

  return digests;
}

export interface ExpectedHash {
  /** The hash, lowercased, because a checksum in capitals is the same checksum. */
  readonly hex: string;
  /** Read from the length rather than chosen from a list. */
  readonly algorithm: HashAlgorithm;
  /** The file a checksum line named, when the line carried one. */
  readonly fileName?: string;
  /** What was read past or disagreed with, none of it a refusal. */
  readonly notes: readonly string[];
}

export type ExpectedHashResult =
  | { readonly ok: true; readonly expected: ExpectedHash }
  | { readonly ok: false; readonly message: string };

/** A `sha256sum` line: the hash, then whitespace, then the file it was made from. */
const checksumLine = /^([0-9a-fA-F]+)[ \t]+[*? ]?(.+)$/;

/** The BSD and `certutil` shape: the algorithm, the file, then the hash. */
const taggedLine = /^([A-Za-z][A-Za-z0-9_-]*)\s*\(([^)]*)\)\s*=\s*([0-9a-fA-F]+)$/;

const bareHash = /^[0-9a-fA-F]+$/;

/** The algorithm a tagged line names, when this page knows the name. */
function readTaggedAlgorithm(tag: string): HashAlgorithm | undefined {
  const normalized = tag.toLowerCase().replace(/[^a-z0-9]/g, '');

  return hashAlgorithms.find((algorithm) => algorithm === normalized);
}

/**
 * The expected hash, read out of whatever it was copied from.
 *
 * Nothing typed is not a failure — the field is optional, and an empty one
 * means the visitor only wanted the digests — so a blank input is `undefined`
 * rather than an error.
 *
 * What arrives here is rarely a bare hash. It is a line off a release page, a
 * line out of a `SHA256SUMS` file, or the output of `shasum` with the file
 * name still attached, so all three are accepted and the file name is kept
 * rather than discarded: a checksum line that names a different file is worth
 * mentioning, though it is a note and not a verdict.
 */
export function readExpectedHash(input: string): ExpectedHashResult | undefined {
  const lines = input.split('\n').map((line) => line.trim()).filter((line) => line !== '');

  if (lines.length === 0) return undefined;

  if (lines.length > 1) {
    return {
      ok: false,
      message: `That is ${lines.length.toLocaleString()} checksums rather than one — a whole SHA256SUMS file, by the look of it. Paste the single line for the file you are checking.`,
    };
  }

  const [line] = lines;
  const notes: string[] = [];
  let hex: string | undefined;
  let fileName: string | undefined;
  let tagged: HashAlgorithm | undefined;
  let taggedName: string | undefined;

  const tag = taggedLine.exec(line);
  const checksum = checksumLine.exec(line);

  if (bareHash.test(line)) {
    hex = line;
  } else if (tag) {
    [, taggedName, fileName, hex] = tag;
    tagged = readTaggedAlgorithm(taggedName);
  } else if (checksum) {
    [, hex, fileName] = checksum;
  } else {
    return {
      ok: false,
      message:
        'That is not a hash. A hash is hexadecimal — the digits 0 to 9 and the letters a to f — on its own, or with the file name after it as a checksum file writes it.',
    };
  }

  const algorithm = getHashAlgorithmForHexLength(hex.length);

  if (!algorithm) {
    return {
      ok: false,
      message: `A hash of ${hex.length.toLocaleString()} characters is not one this page knows. The lengths are ${describeHashLengths()}, for MD5, SHA-1, SHA-256, SHA-384 and SHA-512 — a hash that is a character or two short of one of those was truncated somewhere in the copying.`,
    };
  }

  // The length is what settles the algorithm, so a tag that disagrees with it
  // is reported rather than obeyed: the digits are the evidence, the label
  // beside them is somebody's typing.
  if (tagged && tagged !== algorithm) {
    notes.push(
      `The line is labelled ${getHashAlgorithm(tagged).label}, but ${hex.length.toLocaleString()} characters is ${getHashAlgorithm(algorithm).label}. The hash itself is what was believed.`,
    );
  } else if (taggedName && !tagged) {
    notes.push(
      `The line is labelled ${taggedName}, which is not a digest this page computes. Its length makes it ${getHashAlgorithm(algorithm).label}, and that is what was compared.`,
    );
  }

  if (fileName !== undefined) {
    notes.push(`The line names a file, ${fileName}, and the hash was taken from in front of it.`);
  }

  return { ok: true, expected: { hex: hex.toLowerCase(), algorithm, fileName, notes } };
}

/**
 * Whether the file is the file the hash was made from — or whether the digest
 * needed to say so was never computed.
 */
export type HashMatchState = 'match' | 'mismatch' | 'unchecked';

export const hashMatchLabels = {
  match: 'Match',
  mismatch: 'No match',
  unchecked: 'Not checked',
} as const satisfies Record<HashMatchState, string>;

export interface HashCheck {
  readonly state: HashMatchState;
  readonly headline: string;
  readonly summary: string;
  readonly algorithm: HashAlgorithm;
  readonly expected: string;
  /** What the file actually hashed to, when the digest was computed. */
  readonly actual?: string;
  /** A checksum line that named some other file. A note, never the verdict. */
  readonly nameWarning?: string;
}

/** Whether two names are the same file, ignoring the folders in front of them. */
function isSameFileName(expected: string, actual: string): boolean {
  const base = (name: string) => name.split(/[/\\]/).pop()?.trim().toLowerCase() ?? '';

  return base(expected) === base(actual);
}

/**
 * The answer, in one word, plus the sentence that word needs.
 *
 * A mismatch is not phrased as a failure of the file. A hash disagrees when the
 * download was damaged, when it is a different build or a different version,
 * and when somebody swapped it — and the page cannot tell those apart, so it
 * says what it knows and does not guess at which one happened.
 */
export function checkHash(
  expected: ExpectedHash,
  digests: readonly FileDigest[],
  file: { readonly name: string },
): HashCheck {
  const { label } = getHashAlgorithm(expected.algorithm);
  const actual = digests.find((digest) => digest.algorithm === expected.algorithm)?.hex;
  const nameWarning =
    expected.fileName !== undefined && !isSameFileName(expected.fileName, file.name)
      ? `The checksum line was written for ${expected.fileName}, and this file is called ${file.name}. That is often just a rename, so it is not the answer — but if you did not rename it, you are checking the wrong file.`
      : undefined;

  if (actual === undefined) {
    return {
      state: 'unchecked',
      headline: hashMatchLabels.unchecked,
      summary: `That is a ${label} hash, and ${label} is not among the digests computed for a file this large. Nothing was compared.`,
      algorithm: expected.algorithm,
      expected: expected.hex,
      nameWarning,
    };
  }

  if (actual === expected.hex) {
    return {
      state: 'match',
      headline: hashMatchLabels.match,
      summary: `The ${label} of this file is the hash you pasted. It is the same file those bytes were hashed from.`,
      algorithm: expected.algorithm,
      expected: expected.hex,
      actual,
      nameWarning,
    };
  }

  return {
    state: 'mismatch',
    headline: hashMatchLabels.mismatch,
    summary: `The ${label} of this file is not the hash you pasted, so this is not the file that hash was made from. It could be a damaged download, a different version or build, or a file somebody replaced — the hash cannot tell you which.`,
    algorithm: expected.algorithm,
    expected: expected.hex,
    actual,
    nameWarning,
  };
}

/**
 * The claim the page has to make, where it cannot be missed.
 *
 * A match proves the file matches that hash. It proves nothing about the hash,
 * and if the hash was published on the same page as the download then whoever
 * replaced the file replaced the number beside it — and a match is exactly
 * what they would want a visitor to see. This belongs on the page rather than
 * in an FAQ nobody scrolls to.
 */
export function getHashProvenanceNote(): string {
  return 'A match proves the file is the file that hash was made from — and nothing about where the hash came from. If you copied it off the same page as the download, whoever could replace the file could replace the hash beside it.';
}
