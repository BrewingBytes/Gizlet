import { describe, expect, it } from 'vitest';

import { md5 } from '../../src/data/md5';

const encoder = new TextEncoder();
const hexOf = (bytes: Uint8Array) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
const digestOf = (text: string) => hexOf(md5(encoder.encode(text)));

describe('MD5', () => {
  /**
   * The test suite from appendix A.5 of RFC 1321, verbatim.
   *
   * A hash is exactly the kind of thing that can be subtly wrong and look
   * perfectly plausible — one mistyped constant produces a stable, wrong
   * answer for every input — so this is a known-answer test against the
   * specification rather than against itself.
   */
  it('matches every vector in RFC 1321', () => {
    expect(digestOf('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(digestOf('a')).toBe('0cc175b9c0f1b6a831c399e269772661');
    expect(digestOf('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(digestOf('message digest')).toBe('f96b697d7cb7938d525a2f31aaf161d0');
    expect(digestOf('abcdefghijklmnopqrstuvwxyz')).toBe('c3fcd3d76192e4007dfb496cca67e13b');
    expect(digestOf('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')).toBe(
      'd174ab98d277d9f5a5611c2c9f419d9f',
    );
    expect(digestOf('12345678901234567890123456789012345678901234567890123456789012345678901234567890')).toBe(
      '57edf4a22be3c955ac49da2e2107b67a',
    );
  });

  it('pads correctly at every length around a block boundary', () => {
    // 55, 56 and 64 bytes are where the length field stops fitting in the last
    // block and a second block appears. Getting this wrong breaks only some
    // inputs, which is worse than breaking all of them.
    expect(digestOf('a'.repeat(55))).toBe('ef1772b6dff9a122358552954ad0df65');
    expect(digestOf('a'.repeat(56))).toBe('3b0c8ac703f828b04c6c197006d17218');
    expect(digestOf('a'.repeat(63))).toBe('b06521f39153d618550606be297466d5');
    expect(digestOf('a'.repeat(64))).toBe('014842d480b571495a4a0363793f7367');
    expect(digestOf('a'.repeat(65))).toBe('c743a45e0d2e6a95cb859adae0248435');
  });

  it('hashes a megabyte the same as the reference implementation', () => {
    expect(digestOf('a'.repeat(1_000_000))).toBe('7707d6ae4e027c70eea2a935c2296f21');
  });

  it('reads bytes rather than characters', () => {
    // A UUID version 3 is the digest of UTF-8 bytes, so a character outside
    // ASCII must hash as its bytes and not as anything the platform decides a
    // string is. é is C3 A9, and the two spellings have to agree.
    expect(digestOf('é')).toBe('66ddcd97cfdeabb2f6fb8a999b4bc76f');
    expect(hexOf(md5(new Uint8Array([0xc3, 0xa9])))).toBe(digestOf('é'));
    expect(digestOf('👍')).toBe('0215ac4dab1ecaf71d83f98af5726984');
  });

  it('hashes a zero byte rather than treating it as the end', () => {
    expect(hexOf(md5(new Uint8Array([0x00])))).toBe('93b885adfe0da089cdf634904fd59f71');
    expect(md5(new Uint8Array(0))).toHaveLength(16);
  });
});
