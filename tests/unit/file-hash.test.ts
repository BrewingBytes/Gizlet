import { describe, expect, it } from 'vitest';

import {
  checkHash,
  describeSkippedHashAlgorithm,
  getHashAlgorithm,
  getHashAlgorithmForHexLength,
  getHashAlgorithmsForSize,
  getHashFileNote,
  getHashProvenanceNote,
  getSkippedHashAlgorithms,
  hashAlgorithmDetails,
  hashAlgorithms,
  hashBytes,
  hashBytesWith,
  isHashAlgorithm,
  maximumHashBytes,
  maximumMd5Bytes,
  readExpectedHash,
  toHex,
  validateHashFile,
  type DigestFunction,
  type ExpectedHash,
  type FileDigest,
  type HashAlgorithm,
} from '../../src/data/file-hash';

/** The platform's digest, passed in the way the page passes the browser's. */
const digest: DigestFunction = (subtleName, bytes) => crypto.subtle.digest(subtleName, bytes);

const bytesOf = (text: string) => new TextEncoder().encode(text);

/** The published vectors for "abc", which is what a wrong constant fails on. */
const abc = {
  md5: '900150983cd24fb0d6963f7d28e17f72',
  sha1: 'a9993e364706816aba3e25717850c26c9cd0d89d',
  sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  sha384:
    'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7',
  sha512:
    'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
} as const satisfies Record<HashAlgorithm, string>;

const expectedOf = (input: string): ExpectedHash => {
  const result = readExpectedHash(input);

  if (!result?.ok) throw new Error(`Expected a readable hash: ${input}`);

  return result.expected;
};

const refusalOf = (input: string): string => {
  const result = readExpectedHash(input);

  if (result?.ok !== false) throw new Error(`Expected the hash to be refused: ${input}`);

  return result.message;
};

const digestsOf = (hex: Partial<Record<HashAlgorithm, string>>): readonly FileDigest[] =>
  Object.entries(hex).map(([algorithm, value]) => ({
    algorithm: algorithm as HashAlgorithm,
    hex: value,
  }));

describe('the algorithms on offer', () => {
  it('shows the one people publish first and the broken pair last', () => {
    expect(hashAlgorithms).toEqual(['sha256', 'sha512', 'sha384', 'sha1', 'md5']);
    expect(hashAlgorithmDetails.map((detail) => detail.id)).toEqual([...hashAlgorithms]);
  });

  it('gives every digest a length no other digest shares, since the length names it', () => {
    const lengths = hashAlgorithmDetails.map((detail) => detail.hexLength);

    expect(new Set(lengths)).toHaveLength(lengths.length);
    expect(lengths).toEqual([64, 128, 96, 40, 32]);
  });

  it('labels exactly the two digests that are broken for authenticity', () => {
    expect(hashAlgorithmDetails.filter((detail) => detail.broken).map((detail) => detail.id)).toEqual([
      'sha1',
      'md5',
    ]);
  });

  it('asks the browser for everything except the digest the browser refuses', () => {
    expect(
      hashAlgorithmDetails.filter((detail) => detail.subtleName === undefined).map((detail) => detail.id),
    ).toEqual(['md5']);
  });

  it('reads a hash length back as the digest that wrote it', () => {
    expect(getHashAlgorithmForHexLength(32)).toBe('md5');
    expect(getHashAlgorithmForHexLength(40)).toBe('sha1');
    expect(getHashAlgorithmForHexLength(64)).toBe('sha256');
    expect(getHashAlgorithmForHexLength(96)).toBe('sha384');
    expect(getHashAlgorithmForHexLength(128)).toBe('sha512');
    expect(getHashAlgorithmForHexLength(63)).toBeUndefined();
  });

  it('recognises its own names and nothing else', () => {
    expect(isHashAlgorithm('sha256')).toBe(true);
    expect(isHashAlgorithm('SHA-256')).toBe(false);
    expect(isHashAlgorithm('sha224')).toBe(false);
    expect(() => getHashAlgorithm('sha224' as HashAlgorithm)).toThrow('Missing hash algorithm');
  });

  it('says of each broken digest why it is broken, rather than saying it twice', () => {
    const meanings = hashAlgorithmDetails.filter((detail) => detail.broken);

    expect(meanings.map((detail) => detail.meaning.startsWith('Broken for authenticity'))).toEqual([
      true,
      true,
    ]);
    expect(new Set(meanings.map((detail) => detail.meaning))).toHaveLength(meanings.length);
    expect(getHashAlgorithm('sha256').meaning).not.toContain('Broken');
  });
});

describe('hashing bytes', () => {
  it('produces the published vectors for “abc”', async () => {
    const digests = await hashBytes(bytesOf('abc'), digest);

    expect(digests).toEqual(
      hashAlgorithms.map((algorithm) => ({ algorithm, hex: abc[algorithm] })),
    );
  });

  it('hashes an empty file rather than refusing one', async () => {
    expect(await hashBytesWith('sha256', new Uint8Array(), digest)).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(await hashBytesWith('md5', new Uint8Array(), digest)).toBe(
      'd41d8cd98f00b204e9800998ecf8427e',
    );
    expect(getHashFileNote({ size: 0 })).toContain('every empty file has them');
    expect(getHashFileNote({ size: 1 })).toBeUndefined();
  });

  it('computes MD5 here, since the browser will not', async () => {
    // The digest that is asked for is the only proof this is not routed
    // through `crypto.subtle`, which rejects MD5 outright.
    const asked: string[] = [];
    const watched: DigestFunction = (subtleName, bytes) => {
      asked.push(subtleName);

      return digest(subtleName, bytes);
    };

    expect(await hashBytesWith('md5', bytesOf('abc'), watched)).toBe(abc.md5);
    expect(asked).toEqual([]);
    expect(await hashBytesWith('sha1', bytesOf('abc'), watched)).toBe(abc.sha1);
    expect(asked).toEqual(['SHA-1']);
  });

  it('writes a digest as the lowercase hexadecimal a checksum file uses', () => {
    expect(toHex(new Uint8Array([0, 1, 15, 16, 171, 255]))).toBe('00010f10abff');
    expect(toHex(new Uint8Array())).toBe('');
  });
});

describe('what a file this size gets', () => {
  it('refuses only a file too large to fit in the tab at all', () => {
    expect(validateHashFile({ size: maximumHashBytes })).toBeUndefined();
    expect(validateHashFile({ size: 0 })).toBeUndefined();
    expect(validateHashFile({ size: maximumHashBytes + 1 })).toContain('512 MB');
  });

  it('drops MD5 alone above its own ceiling, and says why', () => {
    expect(getSkippedHashAlgorithms(maximumMd5Bytes)).toEqual([]);
    expect(getSkippedHashAlgorithms(maximumMd5Bytes + 1)).toEqual(['md5']);
    expect(getHashAlgorithmsForSize(maximumMd5Bytes)).toEqual([...hashAlgorithms]);
    expect(getHashAlgorithmsForSize(maximumMd5Bytes + 1)).toEqual([
      'sha256',
      'sha512',
      'sha384',
      'sha1',
    ]);
    expect(describeSkippedHashAlgorithm('md5')).toContain('128 MB');
  });
});

describe('reading the hash somebody published', () => {
  it('treats an empty field as a question not asked', () => {
    expect(readExpectedHash('')).toBeUndefined();
    expect(readExpectedHash('   \n  ')).toBeUndefined();
  });

  it('reads a bare hash and names the digest from its length', () => {
    const expected = expectedOf(abc.sha256);

    expect(expected).toMatchObject({ hex: abc.sha256, algorithm: 'sha256', notes: [] });
    expect(expected.fileName).toBeUndefined();
  });

  it('takes a hash in capitals as the same hash', () => {
    expect(expectedOf(abc.sha1.toUpperCase())).toMatchObject({
      hex: abc.sha1,
      algorithm: 'sha1',
    });
  });

  it('reads the line a checksum file writes, and keeps the file it names', () => {
    const expected = expectedOf(`${abc.sha256}  gizlet-1.0.0.tar.gz`);

    expect(expected).toMatchObject({
      hex: abc.sha256,
      algorithm: 'sha256',
      fileName: 'gizlet-1.0.0.tar.gz',
    });
    expect(expected.notes).toEqual([
      'The line names a file, gizlet-1.0.0.tar.gz, and the hash was taken from in front of it.',
    ]);
  });

  it('reads the binary-mode star and a surrounding line of whitespace', () => {
    expect(expectedOf(`\n  ${abc.md5} *disk.img  \n`)).toMatchObject({
      hex: abc.md5,
      algorithm: 'md5',
      fileName: 'disk.img',
    });
  });

  it('reads the tagged form a BSD tool and certutil write', () => {
    expect(expectedOf(`SHA256 (gizlet.zip) = ${abc.sha256}`)).toMatchObject({
      hex: abc.sha256,
      algorithm: 'sha256',
      fileName: 'gizlet.zip',
    });
    expect(expectedOf(`SHA-512 (gizlet.zip) = ${abc.sha512}`)).toMatchObject({
      algorithm: 'sha512',
    });
  });

  it('believes the digits rather than the label when a tag disagrees with the length', () => {
    const expected = expectedOf(`MD5 (gizlet.zip) = ${abc.sha256}`);

    expect(expected.algorithm).toBe('sha256');
    expect(expected.notes[0]).toBe(
      'The line is labelled MD5, but 64 characters is SHA-256. The hash itself is what was believed.',
    );
  });

  it('says so when a tag names a digest this page does not compute', () => {
    const expected = expectedOf(`SHA3-256 (gizlet.zip) = ${abc.sha256}`);

    expect(expected.algorithm).toBe('sha256');
    expect(expected.notes[0]).toContain('not a digest this page computes');
  });

  it('refuses a whole checksum file and says to paste one line of it', () => {
    expect(refusalOf(`${abc.sha256}  one.tar.gz\n${abc.sha512}  two.tar.gz`)).toContain(
      '2 checksums rather than one',
    );
  });

  it('refuses a hash of a length no digest writes, and names the lengths', () => {
    const message = refusalOf(abc.sha256.slice(0, 63));

    expect(message).toContain('63 characters');
    expect(message).toContain('32, 40, 64, 96, 128');
    expect(message).toContain('truncated');
  });

  it('refuses something that is not hexadecimal at all', () => {
    expect(refusalOf('not a hash at all')).toContain('hexadecimal');
    expect(refusalOf(`${abc.sha256.slice(0, 63)}z`)).toContain('hexadecimal');
  });
});

describe('the verdict', () => {
  const file = { name: 'gizlet.zip' };

  it('answers in one word when the hashes agree', () => {
    const check = checkHash(expectedOf(abc.sha256), digestsOf(abc), file);

    expect(check.state).toBe('match');
    expect(check.headline).toBe('Match');
    expect(check.summary).toContain('the same file those bytes were hashed from');
    expect(check.actual).toBe(abc.sha256);
    expect(check.nameWarning).toBeUndefined();
  });

  it('answers in one word when they do not, without guessing why', () => {
    const check = checkHash(expectedOf(`${'0'.repeat(64)}`), digestsOf(abc), file);

    expect(check.state).toBe('mismatch');
    expect(check.headline).toBe('No match');
    expect(check.summary).toContain('cannot tell you which');
    expect(check.expected).toBe('0'.repeat(64));
    expect(check.actual).toBe(abc.sha256);
  });

  it('compares the digest the hash names rather than the one it prefers', () => {
    const check = checkHash(expectedOf(abc.md5), digestsOf(abc), file);

    expect(check.algorithm).toBe('md5');
    expect(check.state).toBe('match');
  });

  it('says nothing was compared when the digest the hash needs was not computed', () => {
    const check = checkHash(expectedOf(abc.md5), digestsOf({ sha256: abc.sha256 }), file);

    expect(check.state).toBe('unchecked');
    expect(check.headline).toBe('Not checked');
    expect(check.summary).toContain('Nothing was compared');
    expect(check.actual).toBeUndefined();
  });

  it('warns about a checksum line written for some other file, without letting it decide', () => {
    const check = checkHash(expectedOf(`${abc.sha256}  other.zip`), digestsOf(abc), file);

    expect(check.state).toBe('match');
    expect(check.nameWarning).toContain('written for other.zip');
    expect(check.nameWarning).toContain('gizlet.zip');
  });

  it('ignores the folders in front of a name, and the capitals in it', () => {
    expect(
      checkHash(expectedOf(`${abc.sha256}  ./downloads/Gizlet.ZIP`), digestsOf(abc), file)
        .nameWarning,
    ).toBeUndefined();
  });
});

describe('the claim the page has to make', () => {
  it('says a match proves the file and not the provenance of the hash', () => {
    const note = getHashProvenanceNote();

    expect(note).toContain('nothing about where the hash came from');
    expect(note).toContain('replace the hash beside it');
  });
});
