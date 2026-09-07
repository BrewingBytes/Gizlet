import { describe, expect, it } from 'vitest';

import {
  buildMaxUuid,
  buildNilUuid,
  buildRandomNode,
  buildUuidV1,
  buildUuidV3,
  buildUuidV4,
  buildUuidV6,
  buildUuidV7,
  defaultUuidCase,
  defaultUuidKind,
  defaultUuidStyle,
  describeUuid,
  describeUuidFacts,
  finishNameBasedUuid,
  formatUuid,
  getNamespaceUuid,
  getUuidKindDetail,
  isMulticastNode,
  isNameBasedKind,
  isUuid,
  isUuidCase,
  isUuidKind,
  isUuidNamespaceId,
  isUuidStyle,
  maximumUuidBatch,
  maximumUuidV7Counter,
  parseUuid,
  readUuidV7Counter,
  setUuidBits,
  toCanonicalUuid,
  toNameBasedInput,
  uuidCases,
  uuidGregorianOffset,
  uuidKindDetails,
  uuidKinds,
  uuidNamespaces,
  uuidStyleDetails,
  uuidStyles,
  validateUuidCount,
} from '../../src/data/uuid';

const dns = parseUuid(getNamespaceUuid('dns')) as Uint8Array;
const zeros = new Uint8Array(16);
const ones = new Uint8Array(16).fill(0xff);
const node = new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89, 0xab]);
const time = { milliseconds: 1_760_000_000_000, interval: 0, clockSequence: 0x1234, node };

/** The version nibble and variant bits, read straight out of the bytes. */
const bitsOf = (bytes: Uint8Array) => ({ version: bytes[6] >> 4, variant: bytes[8] >> 6 });

describe('the catalogue', () => {
  it('describes every kind it offers and offers every kind it describes', () => {
    expect(uuidKindDetails.map((detail) => detail.kind)).toEqual([...uuidKinds]);
    expect(uuidKinds).toContain(defaultUuidKind);
    expect(uuidStyleDetails.map((detail) => detail.style)).toEqual([...uuidStyles]);
    expect(uuidStyles).toContain(defaultUuidStyle);
    expect(uuidCases).toContain(defaultUuidCase);

    for (const detail of uuidKindDetails) {
      expect(detail.label.length, detail.kind).toBeGreaterThan(0);
      expect(detail.summary.length, detail.kind).toBeGreaterThan(60);
      // Every kind says what it gives away, including the two that give away
      // nothing. A blank here would be the page quietly skipping the question.
      expect(detail.reveals.length, detail.kind).toBeGreaterThan(0);
    }
  });

  it('offers neither version 2 nor version 8, which cannot be made honestly', () => {
    expect(uuidKinds).not.toContain('v2');
    expect(uuidKinds).not.toContain('v8');
  });

  it('knows which kinds are built from a name', () => {
    expect(uuidKinds.filter(isNameBasedKind)).toEqual(['v3', 'v5']);
    expect(uuidKindDetails.filter((detail) => detail.needsName).map((detail) => detail.kind)).toEqual([
      'v3',
      'v5',
    ]);
  });

  it('recognises values that came from outside, and refuses the rest', () => {
    expect(isUuidKind('v7')).toBe(true);
    expect(isUuidKind('v2')).toBe(false);
    expect(isUuidStyle('braces')).toBe(true);
    expect(isUuidStyle('guid')).toBe(false);
    expect(isUuidCase('upper')).toBe(true);
    expect(isUuidCase('title')).toBe(false);
    expect(isUuidNamespaceId('dns')).toBe(true);
    expect(isUuidNamespaceId('ldap')).toBe(false);
    expect(getUuidKindDetail('v1').kind).toBe('v1');
  });

  it('carries the four namespaces RFC 9562 defines, unaltered', () => {
    expect(getNamespaceUuid('dns')).toBe('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
    expect(getNamespaceUuid('url')).toBe('6ba7b811-9dad-11d1-80b4-00c04fd430c8');
    expect(getNamespaceUuid('oid')).toBe('6ba7b812-9dad-11d1-80b4-00c04fd430c8');
    expect(getNamespaceUuid('x500')).toBe('6ba7b814-9dad-11d1-80b4-00c04fd430c8');
    // The fifth is the visitor's own, and deliberately has no value of its own.
    expect(getNamespaceUuid('custom')).toBe('');
    expect(uuidNamespaces).toHaveLength(5);
  });
});

describe('the bits every version stamps', () => {
  it('writes the version nibble and the variant, and touches nothing else', () => {
    const bytes = setUuidBits(new Uint8Array(16).fill(0xff), 4);

    expect(bitsOf(bytes)).toEqual({ version: 4, variant: 2 });
    // Byte 6's low nibble and byte 8's low six bits survive; the rest is intact.
    expect(bytes[6]).toBe(0x4f);
    expect(bytes[8]).toBe(0xbf);
    expect([...bytes.subarray(0, 6)]).toEqual([...ones.subarray(0, 6)]);
    expect([...bytes.subarray(9)]).toEqual([...ones.subarray(9)]);
  });

  it('stamps the same two places for every version', () => {
    for (const version of [1, 3, 4, 5, 6, 7] as const) {
      expect(bitsOf(setUuidBits(new Uint8Array(16), version))).toEqual({ version, variant: 2 });
    }
  });
});

describe('a version 4', () => {
  it('keeps the randomness it was given, apart from the six bits it must overwrite', () => {
    const random = Uint8Array.from({ length: 16 }, (_, index) => index + 1);
    const bytes = buildUuidV4(random);

    expect(bitsOf(bytes)).toEqual({ version: 4, variant: 2 });
    expect([...bytes.subarray(0, 6)]).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...bytes.subarray(9)]).toEqual([10, 11, 12, 13, 14, 15, 16]);
  });

  it('reads back as a version 4', () => {
    const bytes = buildUuidV4(ones);

    expect(describeUuid(toCanonicalUuid(bytes))?.kind).toBe('v4');
  });
});

describe('a version 7', () => {
  it('puts the millisecond in the first six bytes, most significant first', () => {
    const bytes = buildUuidV7(0x0192_3f4a_5b6c, 0, zeros);

    expect([...bytes.subarray(0, 6)]).toEqual([0x01, 0x92, 0x3f, 0x4a, 0x5b, 0x6c]);
    expect(bitsOf(bytes)).toEqual({ version: 7, variant: 2 });
  });

  it('sorts in the order it was made, which is the whole point of it', () => {
    const stamps = [1_760_000_000_000, 1_760_000_000_001, 1_760_000_001_000, 1_770_000_000_000];
    // The randomness is identical, so only the timestamp can be ordering these.
    const made = stamps.map((stamp) => toCanonicalUuid(buildUuidV7(stamp, 0, ones)));

    expect([...made].sort()).toEqual(made);
  });

  it('sorts even when every one was made in the same millisecond', () => {
    // The case that actually happens: something inserts a batch of rows. The
    // timestamp cannot separate them, so the counter has to.
    const stamp = 1_760_000_000_000;
    const made = Array.from({ length: 40 }, (_, index) =>
      toCanonicalUuid(buildUuidV7(stamp, index, ones)),
    );

    expect([...made].sort()).toEqual(made);
    expect(new Set(made).size).toBe(40);
  });

  it('keeps the counter in its twelve bits, clear of the version', () => {
    expect(readUuidV7Counter(buildUuidV7(0, 0x0fff, zeros))).toBe(0x0fff);
    expect(bitsOf(buildUuidV7(0, 0x0fff, zeros))).toEqual({ version: 7, variant: 2 });
    expect(maximumUuidV7Counter).toBe(0x0fff);
    // A counter past its ceiling is masked rather than spilling into the
    // version nibble, which would make the UUID unreadable.
    expect(bitsOf(buildUuidV7(0, 0xffff, zeros))).toEqual({ version: 7, variant: 2 });
  });

  it('keeps 62 bits of randomness after the variant', () => {
    const bytes = buildUuidV7(0, 0, ones);

    expect(bytes[8]).toBe(0xbf);
    expect([...bytes.subarray(9)]).toEqual([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
  });

  it('carries the time back out again', () => {
    const stamp = 1_760_123_456_789;

    expect(describeUuid(toCanonicalUuid(buildUuidV7(stamp, 0, zeros)))?.milliseconds).toBe(stamp);
  });

  it('refuses to write a negative time rather than wrapping it', () => {
    expect([...buildUuidV7(-1, 0, zeros).subarray(0, 6)]).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe('a version 1', () => {
  it('counts from 1582, which is the offset the format is stuck with', () => {
    // 122192928000000000 hundred-nanosecond intervals from 15 October 1582 to
    // 1 January 1970. A wrong offset here dates every UUID by centuries.
    expect(uuidGregorianOffset).toBe(122_192_928_000_000_000n);
  });

  it('lays its fields out low half first, and reads the time back', () => {
    const bytes = buildUuidV1(time);
    const facts = describeUuid(toCanonicalUuid(bytes));

    expect(bitsOf(bytes)).toEqual({ version: 1, variant: 2 });
    expect(facts?.kind).toBe('v1');
    expect(facts?.milliseconds).toBe(time.milliseconds);
    expect(facts?.node).toBe('01:23:45:67:89:ab');
  });

  it('keeps the clock sequence in its fourteen bits, under the variant', () => {
    const bytes = buildUuidV1({ ...time, clockSequence: 0x3fff });

    expect(bytes[8]).toBe(0xbf);
    expect(bytes[9]).toBe(0xff);
    // A sequence wider than fourteen bits is masked rather than overflowing
    // into the variant, which would make the UUID unreadable.
    expect(bitsOf(buildUuidV1({ ...time, clockSequence: 0xffff }))).toEqual({ version: 1, variant: 2 });
  });

  it('distinguishes UUIDs made in the same millisecond by their interval', () => {
    const first = toCanonicalUuid(buildUuidV1({ ...time, interval: 0 }));
    const second = toCanonicalUuid(buildUuidV1({ ...time, interval: 1 }));

    expect(first).not.toBe(second);
    // Both still report the millisecond they were made in.
    expect(describeUuid(second)?.milliseconds).toBe(time.milliseconds);
  });

  it('does not sort by time, which is why version 6 exists', () => {
    // The low 32 bits of the timestamp come first, and they wrap every 2^32
    // hundred-nanosecond intervals — about 429.5 seconds. Values further apart
    // than that sort into an order unrelated to when they were made, and these
    // three are ten minutes apart.
    const offsets = [0, 600_000, 1_200_000];
    const asV1 = offsets.map((offset) =>
      toCanonicalUuid(buildUuidV1({ ...time, milliseconds: time.milliseconds + offset })),
    );
    const asV6 = offsets.map((offset) =>
      toCanonicalUuid(buildUuidV6({ ...time, milliseconds: time.milliseconds + offset })),
    );

    expect([...asV1].sort()).not.toEqual(asV1);
    // The same three moments, in version 6, do sort. That is the difference.
    expect([...asV6].sort()).toEqual(asV6);
  });
});

describe('a version 6', () => {
  it('lays the same timestamp out most significant first, and sorts', () => {
    const made = [0, 1, 1_000, 10_000_000].map((offset) =>
      toCanonicalUuid(buildUuidV6({ ...time, milliseconds: time.milliseconds + offset })),
    );

    expect([...made].sort()).toEqual(made);
    expect(bitsOf(buildUuidV6(time))).toEqual({ version: 6, variant: 2 });
  });

  it('carries the time back out again', () => {
    const facts = describeUuid(toCanonicalUuid(buildUuidV6(time)));

    expect(facts?.kind).toBe('v6');
    expect(facts?.milliseconds).toBe(time.milliseconds);
  });
});

describe('the node field, which normally leaks a MAC address', () => {
  it('flags a random node as not being a real address', () => {
    const random = buildRandomNode(new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44, 0x55]));

    // The multicast bit is what says "this is not a network card".
    expect(random[0] & 0x01).toBe(1);
    expect(isMulticastNode(random)).toBe(true);
    // The other five bytes are the randomness it was handed.
    expect([...random.subarray(1)]).toEqual([0x11, 0x22, 0x33, 0x44, 0x55]);
  });

  it('recognises a real MAC address when one is read back', () => {
    // A genuine unicast MAC has the low bit of its first byte clear.
    const real = new Uint8Array([0x00, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e]);

    expect(isMulticastNode(real)).toBe(false);
    expect(describeUuid(toCanonicalUuid(buildUuidV1({ ...time, node: real })))?.randomNode).toBe(false);
  });

  it('says so in the UUID it produces', () => {
    const random = buildRandomNode(new Uint8Array(6));

    expect(describeUuid(toCanonicalUuid(buildUuidV1({ ...time, node: random })))?.randomNode).toBe(true);
  });
});

describe('the name-based versions', () => {
  /**
   * Known answers, not self-consistency.
   *
   * A name-based UUID is only worth anything if it matches what every other
   * implementation produces for the same name, so these are the published
   * vectors. Getting a different answer here is the bug, not the test.
   */
  it('reproduces the published version 3 vectors', () => {
    expect(toCanonicalUuid(buildUuidV3(dns, 'python.org'))).toBe('6fa459ea-ee8a-3ca4-894e-db77e160355e');
    expect(toCanonicalUuid(buildUuidV3(dns, 'www.example.com'))).toBe('5df41881-3aed-3515-88a7-2f4a814cf09e');
  });

  it('reproduces the published version 5 vectors, through Web Crypto', async () => {
    const digest = async (name: string) =>
      new Uint8Array(await crypto.subtle.digest('SHA-1', toNameBasedInput(dns, name)));

    expect(toCanonicalUuid(finishNameBasedUuid(await digest('python.org'), 5))).toBe(
      '886313e1-3b8a-5372-9b90-0c9aee199e5d',
    );
    expect(toCanonicalUuid(finishNameBasedUuid(await digest('www.example.com'), 5))).toBe(
      '2ed6657d-e927-568b-95e1-2665a8aea6a2',
    );
  });

  it('digests the namespace and then the name, as bytes', () => {
    const input = toNameBasedInput(dns, 'a');

    expect(input).toHaveLength(17);
    expect([...input.subarray(0, 16)]).toEqual([...dns]);
    expect(input[16]).toBe(0x61);
  });

  it('reads a name as UTF-8 rather than as characters', () => {
    // Two bytes for é, so the digest input is one byte longer than the string.
    expect(toNameBasedInput(dns, 'é')).toHaveLength(18);
    expect(toCanonicalUuid(buildUuidV3(dns, 'é'))).not.toBe(toCanonicalUuid(buildUuidV3(dns, 'e')));
  });

  it('gives the same answer every time, which is what it is for', () => {
    expect(toCanonicalUuid(buildUuidV3(dns, 'example.com'))).toBe(
      toCanonicalUuid(buildUuidV3(dns, 'example.com')),
    );
    // And a different answer in a different namespace.
    const url = parseUuid(getNamespaceUuid('url')) as Uint8Array;

    expect(toCanonicalUuid(buildUuidV3(url, 'example.com'))).not.toBe(
      toCanonicalUuid(buildUuidV3(dns, 'example.com')),
    );
  });

  it('keeps the version bits after the digest overwrote them', () => {
    expect(bitsOf(buildUuidV3(dns, 'anything'))).toEqual({ version: 3, variant: 2 });
    expect(bitsOf(finishNameBasedUuid(ones, 5))).toEqual({ version: 5, variant: 2 });
  });
});

describe('the two that are not versions', () => {
  it('makes the Nil and the Max exactly', () => {
    expect(toCanonicalUuid(buildNilUuid())).toBe('00000000-0000-0000-0000-000000000000');
    expect(toCanonicalUuid(buildMaxUuid())).toBe('ffffffff-ffff-ffff-ffff-ffffffffffff');
  });

  it('reads them back as themselves rather than as a version', () => {
    expect(describeUuid('00000000-0000-0000-0000-000000000000')).toMatchObject({
      kind: 'nil',
      variant: 'nil',
      version: 0,
    });
    expect(describeUuid('ffffffff-ffff-ffff-ffff-ffffffffffff')).toMatchObject({
      kind: 'max',
      variant: 'max',
      version: 15,
    });
  });
});

describe('writing one down', () => {
  const bytes = parseUuid('3f2b8c1a-4d5e-4f60-8a71-9b2c3d4e5f60') as Uint8Array;

  it('writes every style, in either case', () => {
    expect(formatUuid(bytes, 'canonical', 'lower')).toBe('3f2b8c1a-4d5e-4f60-8a71-9b2c3d4e5f60');
    expect(formatUuid(bytes, 'canonical', 'upper')).toBe('3F2B8C1A-4D5E-4F60-8A71-9B2C3D4E5F60');
    expect(formatUuid(bytes, 'braces', 'upper')).toBe('{3F2B8C1A-4D5E-4F60-8A71-9B2C3D4E5F60}');
    expect(formatUuid(bytes, 'compact', 'lower')).toBe('3f2b8c1a4d5e4f608a719b2c3d4e5f60');
    expect(formatUuid(bytes, 'urn', 'lower')).toBe('urn:uuid:3f2b8c1a-4d5e-4f60-8a71-9b2c3d4e5f60');
  });

  it('keeps a URN’s scheme lower case whatever case the value is in', () => {
    // The scheme and namespace are case-insensitive and written lower case by
    // convention; the visitor's choice applies to the value.
    expect(formatUuid(bytes, 'urn', 'upper')).toBe('urn:uuid:3F2B8C1A-4D5E-4F60-8A71-9B2C3D4E5F60');
  });

  it('pads a byte that needs it, rather than dropping a digit', () => {
    const small = new Uint8Array(16);

    small[15] = 0x05;
    expect(toCanonicalUuid(small)).toBe('00000000-0000-0000-0000-000000000005');
  });
});

describe('reading one back', () => {
  it('accepts every style it writes, and any case', () => {
    const canonical = '3f2b8c1a-4d5e-4f60-8a71-9b2c3d4e5f60';

    for (const text of [
      canonical,
      canonical.toUpperCase(),
      `{${canonical.toUpperCase()}}`,
      `(${canonical})`,
      canonical.replace(/-/g, ''),
      `urn:uuid:${canonical}`,
      `URN:UUID:${canonical}`,
      `  ${canonical}  `,
    ]) {
      expect(toCanonicalUuid(parseUuid(text) as Uint8Array), text).toBe(canonical);
      expect(isUuid(text), text).toBe(true);
    }
  });

  it('refuses anything that is not one', () => {
    for (const text of [
      '',
      'hello',
      '3f2b8c1a-4d5e-4f60-8a71-9b2c3d4e5f6',
      '3f2b8c1a-4d5e-4f60-8a71-9b2c3d4e5f600',
      '3f2b8c1a-4d5e-4f60-8a71-9b2c3d4e5f6g',
      '00000000000000000000000000000000 extra',
    ]) {
      expect(parseUuid(text), text).toBeUndefined();
      expect(isUuid(text), text).toBe(false);
    }
  });

  it('names the older layouts rather than misreading their fields', () => {
    // The variant bits, not the version nibble, decide whether the fields mean
    // anything at all. Reading a version out of an NCS value is nonsense.
    expect(describeUuid('3f2b8c1a-4d5e-4f60-0a71-9b2c3d4e5f60')?.variant).toBe('ncs');
    expect(describeUuid('3f2b8c1a-4d5e-4f60-ca71-9b2c3d4e5f60')?.variant).toBe('microsoft');
    expect(describeUuid('3f2b8c1a-4d5e-4f60-ea71-9b2c3d4e5f60')?.variant).toBe('future');
    expect(describeUuid('3f2b8c1a-4d5e-4f60-8a71-9b2c3d4e5f60')?.variant).toBe('rfc');
    // And none of those three claims to be a kind this Gizlet makes.
    expect(describeUuid('3f2b8c1a-4d5e-4f60-0a71-9b2c3d4e5f60')?.kind).toBeUndefined();
  });

  it('leaves a version it does not read without a kind', () => {
    expect(describeUuid('3f2b8c1a-4d5e-2f60-8a71-9b2c3d4e5f60')?.version).toBe(2);
    expect(describeUuid('3f2b8c1a-4d5e-2f60-8a71-9b2c3d4e5f60')?.kind).toBeUndefined();
    expect(describeUuid('3f2b8c1a-4d5e-8f60-8a71-9b2c3d4e5f60')?.kind).toBeUndefined();
  });
});

describe('what the page says about one', () => {
  const at = (milliseconds: number) => new Date(milliseconds).toISOString();

  it('says when a time-based one was made', () => {
    const facts = describeUuid(toCanonicalUuid(buildUuidV7(1_760_123_456_789, 0, zeros)));

    expect(describeUuidFacts(facts!, at)).toContain('Version 7');
    expect(describeUuidFacts(facts!, at)).toContain('2025-10-10');
  });

  it('says whether a version 1 identifies the machine that made it', () => {
    const random = describeUuid(
      toCanonicalUuid(buildUuidV1({ ...time, node: buildRandomNode(new Uint8Array(6)) })),
    );
    const real = describeUuid(
      toCanonicalUuid(buildUuidV1({ ...time, node: new Uint8Array([0x00, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e]) })),
    );

    expect(describeUuidFacts(random!, at)).toContain('identifies no machine');
    expect(describeUuidFacts(real!, at)).toContain('identifies the machine');
  });

  it('says nothing is in a version 4 but randomness', () => {
    const facts = describeUuid(toCanonicalUuid(buildUuidV4(ones)));

    expect(describeUuidFacts(facts!, at)).toContain('nothing in it but randomness');
  });

  it('explains the versions it will not make rather than failing at them', () => {
    const two = describeUuid('3f2b8c1a-4d5e-2f60-8a71-9b2c3d4e5f60');
    const eight = describeUuid('3f2b8c1a-4d5e-8f60-8a71-9b2c3d4e5f60');

    expect(describeUuidFacts(two!, at)).toContain('POSIX');
    expect(describeUuidFacts(eight!, at)).toContain('free-form');
  });

  it('names the Nil and the Max, and the layouts that have no version', () => {
    expect(describeUuidFacts(describeUuid('00000000-0000-0000-0000-000000000000')!, at)).toContain(
      'zero bits',
    );
    expect(describeUuidFacts(describeUuid('ffffffff-ffff-ffff-ffff-ffffffffffff')!, at)).toContain(
      'every bit set',
    );
    expect(
      describeUuidFacts(describeUuid('3f2b8c1a-4d5e-4f60-0a71-9b2c3d4e5f60')!, at),
    ).toContain('Apollo NCS');
  });
});

describe('how many at once', () => {
  it('takes one, takes the cap, and refuses past it', () => {
    expect(validateUuidCount(1)).toBeUndefined();
    expect(validateUuidCount(maximumUuidBatch)).toBeUndefined();
    expect(validateUuidCount(maximumUuidBatch + 1)).toContain('up to');
    expect(validateUuidCount(0)).toContain('at least one');
    expect(validateUuidCount(-5)).toContain('at least one');
    expect(validateUuidCount(2.5)).toContain('at least one');
    expect(validateUuidCount(Number.NaN)).toContain('at least one');
  });
});
