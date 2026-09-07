import { md5 } from './md5';

/**
 * UUIDs: making them, writing them down, and reading one back.
 *
 * A UUID is 128 bits with a handful of fields stamped into fixed positions, so
 * everything here works on sixteen bytes and nothing works on a string until
 * the last moment. That is what makes it testable: the version and variant
 * bits either land where RFC 9562 says they land or they do not, and a test
 * can read them straight out of the bytes.
 *
 * Two things this deliberately does not do.
 *
 * It does not generate a **version 2**. DCE Security replaces the low half of
 * the timestamp with a POSIX user or group id and the low byte of the clock
 * sequence with a local domain, and a browser has no POSIX identity to put
 * there. Producing one would mean inventing the field that gives the
 * identifier its meaning — fabricated provenance inside a thing whose whole
 * purpose is provenance. RFC 9562 does not define it either; it survives only
 * in DCE 1.1. The page explains that instead, which is worth more to whoever
 * came looking for it than a convincing fake.
 *
 * It does not generate a **version 8**, which is free-form by definition and
 * says nothing at all without bytes its caller supplies.
 *
 * The randomness is never `Math.random()`. Every builder here takes the bytes
 * it needs as an argument, so this module has no source of entropy of its own
 * and the tests can hand it known bytes; `scripts/uuid-generation` is where
 * `crypto.getRandomValues` is actually called.
 */

/**
 * What this Gizlet can produce, in version order.
 *
 * Version order rather than order of usefulness: someone who knows which
 * version they want is looking for a number, and a list that puts 4 first and
 * 1 third makes them read all of it. Nil and Max come last because they are
 * not versions at all. Version 4 is still the default, which is a separate
 * question from where it sits in the list.
 */
export const uuidKinds = ['v1', 'v3', 'v4', 'v5', 'v6', 'v7', 'nil', 'max'] as const;

export type UuidKind = (typeof uuidKinds)[number];

/** The version nibble each kind writes, where it writes one. */
export const uuidVersionNumbers = { v1: 1, v3: 3, v4: 4, v5: 5, v6: 6, v7: 7 } as const;

export type UuidVersion = (typeof uuidVersionNumbers)[keyof typeof uuidVersionNumbers];

export interface UuidKindDetail {
  readonly kind: UuidKind;
  readonly label: string;
  /** What it is for, in the words of the job rather than of the standard. */
  readonly summary: string;
  /** Whether it is derived from a name the visitor gives it. */
  readonly needsName: boolean;
  /** What the value tells anyone who has it. Never nothing, for most of these. */
  readonly reveals: string;
}

export const uuidKindDetails = [
  {
    kind: 'v1',
    label: 'Version 1 · time and node',
    summary:
      'The original: a 60-bit timestamp counting hundred-nanosecond intervals since 1582, a clock sequence, and a node. Generated here when something old expects one.',
    needsName: false,
    reveals:
      'When it was made. Not where: a browser cannot read a MAC address, so the node is random and flagged as such, which is the one thing a v1 usually gives away.',
  },
  {
    kind: 'v3',
    label: 'Version 3 · name, MD5',
    summary:
      'Derived from a namespace and a name with MD5, so the same name always gives the same UUID. Use it only to match identifiers a system already generated this way; for anything new, version 5.',
    needsName: true,
    reveals:
      'That it came from your name, to anyone who guesses the name: they can generate it themselves and confirm it.',
  },
  {
    kind: 'v4',
    label: 'Version 4 · random',
    summary:
      '122 bits of randomness and six bits saying so. The one to use when an identifier only has to be unique and nothing else, which is nearly always.',
    needsName: false,
    reveals: 'Nothing. There is nothing in it but randomness.',
  },
  {
    kind: 'v5',
    label: 'Version 5 · name, SHA-1',
    summary:
      'The same idea with SHA-1 instead, which is the one to use when you want a UUID that is a stable function of a name — a URL, a filename, an account — rather than a new random value each time.',
    needsName: true,
    reveals: 'The same as a version 3: anyone who guesses the name can reproduce it.',
  },
  {
    kind: 'v6',
    label: 'Version 6 · time-ordered v1',
    summary:
      "Version 1's fields rearranged so the timestamp reads most-significant-first and the value sorts by time. For a system that wants v1's shape and an index that behaves.",
    needsName: false,
    reveals: 'When it was made, the same as a version 1.',
  },
  {
    kind: 'v7',
    label: 'Version 7 · time-ordered',
    summary:
      'The number of milliseconds since 1970, then a counter, then randomness, so two of them sort into the order they were made even when both were made in the same millisecond. The one to reach for as a database key: an index stays tidy instead of taking a random write every time.',
    needsName: false,
    reveals: 'The millisecond it was created, in plain sight and by design.',
  },
  {
    kind: 'nil',
    label: 'Nil · all zeroes',
    summary:
      'The one UUID that is defined to mean nothing: 128 zero bits. Useful as an explicit absence, and for testing whether something checks its input.',
    needsName: false,
    reveals: 'Nothing whatsoever.',
  },
  {
    kind: 'max',
    label: 'Max · all ones',
    summary:
      "Every bit set, the largest value there is. RFC 9562 added it as the Nil's opposite, and it is mostly good for finding out what breaks.",
    needsName: false,
    reveals: 'Nothing whatsoever.',
  },
] as const satisfies readonly UuidKindDetail[];

export const defaultUuidKind: UuidKind = 'v4';

export function isUuidKind(value: string): value is UuidKind {
  return (uuidKinds as readonly string[]).includes(value);
}

export function getUuidKindDetail(kind: UuidKind): UuidKindDetail {
  return uuidKindDetails.find((detail) => detail.kind === kind) ?? uuidKindDetails[0];
}

/** Whether a kind is built from a namespace and a name rather than from entropy. */
export function isNameBasedKind(kind: UuidKind): kind is 'v3' | 'v5' {
  return kind === 'v3' || kind === 'v5';
}

/**
 * How a UUID is written down.
 *
 * A GUID is not a different kind of identifier — it is the same 128 bits with
 * Microsoft's punctuation, which is why "GUID" is a style here rather than an
 * entry in the list of versions above.
 */
export const uuidStyles = ['canonical', 'braces', 'compact', 'urn'] as const;

export type UuidStyle = (typeof uuidStyles)[number];

export const uuidStyleDetails = [
  { style: 'canonical', label: 'Canonical', example: '3f2b8c1a-4d5e-4f60-8a71-9b2c3d4e5f60' },
  { style: 'braces', label: 'Braces, as a GUID', example: '{3F2B8C1A-4D5E-4F60-8A71-9B2C3D4E5F60}' },
  { style: 'compact', label: 'No hyphens', example: '3f2b8c1a4d5e4f608a719b2c3d4e5f60' },
  { style: 'urn', label: 'URN', example: 'urn:uuid:3f2b8c1a-4d5e-4f60-8a71-9b2c3d4e5f60' },
] as const satisfies readonly { style: UuidStyle; label: string; example: string }[];

export const uuidCases = ['lower', 'upper'] as const;

export type UuidCase = (typeof uuidCases)[number];

export const defaultUuidStyle: UuidStyle = 'canonical';
export const defaultUuidCase: UuidCase = 'lower';

export function isUuidStyle(value: string): value is UuidStyle {
  return (uuidStyles as readonly string[]).includes(value);
}

export function isUuidCase(value: string): value is UuidCase {
  return (uuidCases as readonly string[]).includes(value);
}

/** How many one run produces. Text, so the ceiling is patience rather than memory. */
export const maximumUuidBatch = 1_000;

export function validateUuidCount(count: number): string | undefined {
  if (!Number.isInteger(count) || count < 1) return 'Ask for at least one.';

  if (count > maximumUuidBatch) {
    return `One run makes up to ${maximumUuidBatch.toLocaleString()} at a time.`;
  }

  return undefined;
}

/** The four namespaces RFC 9562 defines, offered by name so nobody types them. */
export const uuidNamespaces = [
  { id: 'dns', label: 'DNS', uuid: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', hint: 'a host name, like example.com' },
  { id: 'url', label: 'URL', uuid: '6ba7b811-9dad-11d1-80b4-00c04fd430c8', hint: 'a whole address' },
  { id: 'oid', label: 'OID', uuid: '6ba7b812-9dad-11d1-80b4-00c04fd430c8', hint: 'an ISO object identifier' },
  { id: 'x500', label: 'X.500', uuid: '6ba7b814-9dad-11d1-80b4-00c04fd430c8', hint: 'a directory name' },
  { id: 'custom', label: 'Your own', uuid: '', hint: 'any UUID you paste below' },
] as const;

export type UuidNamespaceId = (typeof uuidNamespaces)[number]['id'];

export function isUuidNamespaceId(value: string): value is UuidNamespaceId {
  return uuidNamespaces.some((namespace) => namespace.id === value);
}

export function getNamespaceUuid(id: UuidNamespaceId): string {
  return uuidNamespaces.find((namespace) => namespace.id === id)?.uuid ?? '';
}

/**
 * 100-nanosecond intervals between 15 October 1582 and 1 January 1970.
 *
 * Versions 1 and 6 count from the day the Gregorian calendar was adopted,
 * which is a decision from 1997 that nobody has been able to undo since.
 */
export const uuidGregorianOffset = 122_192_928_000_000_000n;

const hex = (byte: number) => byte.toString(16).padStart(2, '0');

/** The canonical 8-4-4-4-12, lower case, which every other style is built from. */
export function toCanonicalUuid(bytes: Uint8Array): string {
  const text = [...bytes].map(hex).join('');

  return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`;
}

export function formatUuid(bytes: Uint8Array, style: UuidStyle, letterCase: UuidCase): string {
  const canonical = toCanonicalUuid(bytes);
  const cased = letterCase === 'upper' ? canonical.toUpperCase() : canonical;

  if (style === 'braces') return `{${cased}}`;
  if (style === 'compact') return cased.replace(/-/g, '');
  // The scheme and namespace of a URN are case-insensitive but written lower
  // case by convention, so the visitor's choice applies to the value alone.
  if (style === 'urn') return `urn:uuid:${cased}`;

  return cased;
}

/**
 * Sixteen bytes read out of anything anyone might paste: canonical, braced,
 * hyphenless, a URN, upper case, with stray whitespace. Nothing else.
 */
export function parseUuid(text: string): Uint8Array<ArrayBuffer> | undefined {
  const cleaned = text
    .trim()
    .replace(/^urn:uuid:/i, '')
    .replace(/^[{(]|[)}]$/g, '')
    .replace(/-/g, '');

  if (!/^[0-9a-f]{32}$/i.test(cleaned)) return undefined;

  const bytes = new Uint8Array(16);

  for (let index = 0; index < 16; index += 1) {
    bytes[index] = Number.parseInt(cleaned.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

export function isUuid(text: string): boolean {
  return parseUuid(text) !== undefined;
}

/**
 * Stamps the version nibble and the variant bits into their fixed positions.
 *
 * Every version does this and every version does it in the same two places, so
 * it is written once. The variant is `10` in the top two bits of byte 8, which
 * is what marks the value as one of these rather than one of the older layouts
 * that used the same 128 bits differently.
 */
export function setUuidBits(bytes: Uint8Array, version: UuidVersion): Uint8Array {
  bytes[6] = (bytes[6] & 0x0f) | (version << 4);
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return bytes;
}

/** A version 4, from sixteen random bytes. Two of them are overwritten. */
export function buildUuidV4(random: Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(16);

  bytes.set(random.subarray(0, 16));

  return setUuidBits(bytes, 4) as Uint8Array<ArrayBuffer>;
}

/** The counter a version 7 keeps inside one millisecond. Twelve bits. */
export const maximumUuidV7Counter = 0x0fff;

/**
 * A version 7: 48 bits of Unix milliseconds, a counter, then randomness.
 *
 * The timestamp goes in most-significant-first, which is the trick that makes
 * these sort — but a millisecond is a long time, and several made inside one
 * would share every ordered bit and differ only in randomness. So the twelve
 * bits after the timestamp are the counter RFC 9562 offers for exactly this
 * ("replace leftmost random bits with a monotonic counter"), and the caller
 * advances it within a millisecond and reseeds it when the millisecond turns.
 *
 * Without it, "sorts in the order they were made" would be true of two UUIDs a
 * second apart and false of forty made at once, which is the case that
 * actually happens when something inserts a batch of rows.
 */
export function buildUuidV7(
  milliseconds: number,
  counter: number,
  random: Uint8Array,
): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(16);
  const stamp = BigInt(Math.max(0, Math.floor(milliseconds))) & 0xffff_ffff_ffffn;

  for (let index = 0; index < 6; index += 1) {
    bytes[index] = Number((stamp >> BigInt((5 - index) * 8)) & 0xffn);
  }

  const counted = Math.max(0, Math.floor(counter)) & maximumUuidV7Counter;

  new DataView(bytes.buffer).setUint16(6, counted);
  // The remaining 62 bits, once the variant has taken two of byte 8.
  bytes.set(random.subarray(0, 8), 8);

  return setUuidBits(bytes, 7) as Uint8Array<ArrayBuffer>;
}

/** The counter a version 7 carries, which is what orders two made at once. */
export function readUuidV7Counter(bytes: Uint8Array): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(6) & 0x0fff;
}

export interface UuidTimeInput {
  /** Milliseconds since 1970, which is what a browser clock gives. */
  readonly milliseconds: number;
  /**
   * Which hundred-nanosecond interval inside that millisecond, 0 to 9,999.
   *
   * A browser clock cannot see below the millisecond, so this is a counter
   * rather than a measurement: it is what keeps ten UUIDs made in the same
   * millisecond from being the same UUID.
   */
  readonly interval: number;
  /** 14 bits, random per run, as RFC 9562 allows when the clock is coarse. */
  readonly clockSequence: number;
  /** Six bytes. Never a MAC address here; see `buildRandomNode`. */
  readonly node: Uint8Array;
}

/** The 60-bit timestamp versions 1 and 6 share. */
function toGregorianTicks(input: UuidTimeInput): bigint {
  const ticks =
    BigInt(Math.max(0, Math.floor(input.milliseconds))) * 10_000n +
    BigInt(Math.max(0, Math.min(9_999, Math.floor(input.interval)))) +
    uuidGregorianOffset;

  return ticks & 0x0fff_ffff_ffff_ffffn;
}

function writeClockAndNode(bytes: Uint8Array, input: UuidTimeInput): void {
  const sequence = input.clockSequence & 0x3fff;

  bytes[8] = (sequence >> 8) & 0x3f;
  bytes[9] = sequence & 0xff;
  bytes.set(input.node.subarray(0, 6), 10);
}

/** A version 1, in the field order of 1997: low half of the time first. */
export function buildUuidV1(input: UuidTimeInput): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  const ticks = toGregorianTicks(input);

  view.setUint32(0, Number(ticks & 0xffff_ffffn));
  view.setUint16(4, Number((ticks >> 32n) & 0xffffn));
  view.setUint16(6, Number((ticks >> 48n) & 0x0fffn));
  writeClockAndNode(bytes, input);

  return setUuidBits(bytes, 1) as Uint8Array<ArrayBuffer>;
}

/** A version 6: the same timestamp, most-significant-first, so it sorts. */
export function buildUuidV6(input: UuidTimeInput): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  const ticks = toGregorianTicks(input);

  for (let index = 0; index < 6; index += 1) {
    bytes[index] = Number((ticks >> BigInt(52 - index * 8)) & 0xffn);
  }

  view.setUint16(6, Number(ticks & 0x0fffn));
  writeClockAndNode(bytes, input);

  return setUuidBits(bytes, 6) as Uint8Array<ArrayBuffer>;
}

/**
 * A node field for a machine whose MAC address cannot be read.
 *
 * This is the interesting privacy detail of the whole Gizlet. A version 1 was
 * designed to carry the network card's address, which is why one found in a
 * document can identify the machine that made it — famously, in the Melissa
 * virus case. A browser cannot see a MAC address at all, so RFC 9562 says to
 * use a random node and set its multicast bit, which marks it as not being a
 * real address. A v1 from here therefore cannot leak a MAC, and says as much
 * in its own bits to anyone who reads it back.
 */
export function buildRandomNode(random: Uint8Array): Uint8Array<ArrayBuffer> {
  const node = new Uint8Array(6);

  node.set(random.subarray(0, 6));
  node[0] |= 0x01;

  return node;
}

/** Whether a node field says it is not a real network address. */
export function isMulticastNode(node: Uint8Array): boolean {
  return (node[0] & 0x01) === 1;
}

/** The bytes a name-based UUID is the digest of: the namespace, then the name. */
export function toNameBasedInput(namespace: Uint8Array, name: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(name);
  const input = new Uint8Array(16 + encoded.length);

  input.set(namespace.subarray(0, 16));
  input.set(encoded, 16);

  return input;
}

/**
 * A name-based UUID from a digest: the first sixteen bytes, then the bits.
 *
 * Both versions are this function; only the digest differs. Version 3 is MD5,
 * which the platform refuses to compute and `data/md5` therefore provides, and
 * version 5 is SHA-1, which `crypto.subtle` does.
 */
export function finishNameBasedUuid(digest: Uint8Array, version: 3 | 5): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(16);

  bytes.set(digest.subarray(0, 16));

  return setUuidBits(bytes, version) as Uint8Array<ArrayBuffer>;
}

/** A version 3, whole, since its digest needs no browser. */
export function buildUuidV3(namespace: Uint8Array, name: string): Uint8Array<ArrayBuffer> {
  return finishNameBasedUuid(md5(toNameBasedInput(namespace, name)), 3);
}

export function buildNilUuid(): Uint8Array<ArrayBuffer> {
  return new Uint8Array(16);
}

export function buildMaxUuid(): Uint8Array<ArrayBuffer> {
  return new Uint8Array(16).fill(0xff);
}

/**
 * The older layouts the variant bits distinguish.
 *
 * Almost everything is `rfc`. The others are here because a UUID that is not
 * one of these is worth saying so about rather than misreading: an Apollo NCS
 * value or an early Microsoft GUID has its fields in different places, so its
 * version nibble means nothing.
 */
export type UuidVariant = 'nil' | 'max' | 'ncs' | 'rfc' | 'microsoft' | 'future';

export interface UuidFacts {
  readonly bytes: Uint8Array;
  readonly canonical: string;
  readonly variant: UuidVariant;
  /** The version nibble as stored, meaningful only when the variant is `rfc`. */
  readonly version: number;
  /** Which of this Gizlet's kinds it is, when it is one of them. */
  readonly kind?: UuidKind;
  /** Milliseconds since 1970, for the versions that carry a time. */
  readonly milliseconds?: number;
  readonly node?: string;
  /** Whether the node says it is not a real network address. */
  readonly randomNode?: boolean;
}

function readVariant(bytes: Uint8Array): UuidVariant {
  if (bytes.every((byte) => byte === 0)) return 'nil';
  if (bytes.every((byte) => byte === 0xff)) return 'max';

  const marker = bytes[8] >> 5;

  if (marker <= 3) return 'ncs';
  if (marker <= 5) return 'rfc';
  if (marker === 6) return 'microsoft';

  return 'future';
}

function readGregorianMilliseconds(ticks: bigint): number {
  return Number((ticks - uuidGregorianOffset) / 10_000n);
}

/**
 * What a UUID says about itself.
 *
 * The point of this half of the Gizlet: paste one in and find out which
 * version it is, when it was made if it says, and whether the node in it is a
 * real network address or a random one. That last question is the difference
 * between a v1 that identified a machine and a v1 that did not.
 */
export function describeUuid(text: string): UuidFacts | undefined {
  const bytes = parseUuid(text);

  if (!bytes) return undefined;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const variant = readVariant(bytes);
  const version = bytes[6] >> 4;
  const canonical = toCanonicalUuid(bytes);
  const base = { bytes, canonical, variant, version };

  if (variant === 'nil') return { ...base, version: 0, kind: 'nil' };
  if (variant === 'max') return { ...base, version: 15, kind: 'max' };
  if (variant !== 'rfc') return base;

  const node = [...bytes.subarray(10)].map(hex).join(':');

  if (version === 1) {
    const ticks =
      (BigInt(view.getUint16(6) & 0x0fff) << 48n) |
      (BigInt(view.getUint16(4)) << 32n) |
      BigInt(view.getUint32(0));

    return {
      ...base,
      kind: 'v1',
      milliseconds: readGregorianMilliseconds(ticks),
      node,
      randomNode: isMulticastNode(bytes.subarray(10)),
    };
  }

  if (version === 6) {
    let ticks = 0n;

    for (let index = 0; index < 6; index += 1) ticks = (ticks << 8n) | BigInt(bytes[index]);

    ticks = (ticks << 12n) | BigInt(view.getUint16(6) & 0x0fff);

    return {
      ...base,
      kind: 'v6',
      milliseconds: readGregorianMilliseconds(ticks),
      node,
      randomNode: isMulticastNode(bytes.subarray(10)),
    };
  }

  if (version === 7) {
    let stamp = 0n;

    for (let index = 0; index < 6; index += 1) stamp = (stamp << 8n) | BigInt(bytes[index]);

    return { ...base, kind: 'v7', milliseconds: Number(stamp) };
  }

  if (version === 3 || version === 4 || version === 5) {
    return { ...base, kind: `v${version}` as UuidKind };
  }

  return base;
}

/** What the page says about a UUID somebody pasted in. */
export function describeUuidFacts(facts: UuidFacts, formatTime: (milliseconds: number) => string): string {
  if (facts.variant === 'nil') return 'The Nil UUID: 128 zero bits, defined to mean nothing.';
  if (facts.variant === 'max') return 'The Max UUID: every bit set, the largest there is.';

  if (facts.variant === 'ncs') {
    return 'An Apollo NCS UUID, which predates this layout. Its fields are in different places, so it has no version to read.';
  }

  if (facts.variant === 'microsoft') {
    return 'An early Microsoft GUID, from before the layouts were reconciled. Its fields are in different places, so it has no version to read.';
  }

  if (facts.variant === 'future') {
    return 'A UUID whose variant is reserved for future use. Nothing can be said about its fields.';
  }

  if (!facts.kind) {
    return `Version ${facts.version}, which this Gizlet does not read. ${facts.version === 2 ? 'Version 2 is DCE Security, and its fields hold a POSIX user or group id.' : 'Version 8 is free-form, so its contents mean whatever made it says they mean.'}`;
  }

  const detail = getUuidKindDetail(facts.kind);

  if (facts.milliseconds === undefined) return `${detail.label}. ${detail.reveals}`;

  const made = `Made ${formatTime(facts.milliseconds)}.`;

  if (facts.randomNode === undefined) return `${detail.label}. ${made}`;

  return `${detail.label}. ${made} ${
    facts.randomNode
      ? 'Its node is flagged as not a real network address, so it identifies no machine.'
      : 'Its node looks like a real MAC address, which identifies the machine that made it.'
  }`;
}
