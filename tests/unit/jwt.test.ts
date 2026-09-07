import { describe, expect, it } from 'vitest';

import {
  cleanJwtInput,
  decodeJwt,
  describeJwtHeader,
  formatJwtInstant,
  formatJwtValue,
  getJwtAlgorithmNote,
  getJwtNotVerifiedNote,
  getJwtSignatureNote,
  getJwtWindow,
  jwtHeaderParameters,
  jwtRegisteredClaims,
  jwtWindowLabels,
  maximumJwtLength,
  readJwtClaims,
  readJwtTime,
  type DecodedJwt,
} from '../../src/data/jwt';

/** A segment, written the way a token writes one: URL-safe and unpadded. */
const segment = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

const signature = Buffer.from('a signature of sixteen', 'utf8').toString('base64url');

const build = (header: unknown, payload: unknown, tail: string = signature) =>
  `${segment(header)}.${segment(payload)}.${tail}`;

/** The token, insisting it decoded, so the assertions below stay readable. */
const tokenOf = (input: string): DecodedJwt => {
  const result = decodeJwt(input);

  if (!result.ok) throw new Error(`Expected the token to decode: ${result.error.message}`);

  return result.token;
};

/** The complaint, insisting it failed, for the same reason. */
const failureOf = (input: string) => {
  const result = decodeJwt(input);

  if (result.ok) throw new Error('Expected the token not to decode.');

  return result;
};

/** 2026-09-07 09:15:00 UTC, as a clock and as a NumericDate. */
const now = Date.UTC(2026, 8, 7, 9, 15, 0);
const nowSeconds = Math.floor(now / 1000);

describe('decodeJwt', () => {
  it('reads the header and the payload of an ordinary token', () => {
    const token = tokenOf(build({ alg: 'HS256', typ: 'JWT' }, { sub: '1234', name: 'Ada' }));

    expect(token.header.value).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(token.payload.value).toEqual({ sub: '1234', name: 'Ada' });
    expect(token.algorithm).toBe('HS256');
    expect(token.header.json).toBe('{\n  "alg": "HS256",\n  "typ": "JWT"\n}');
    expect(token.signature.byteLength).toBe(22);
    expect(token.signature.empty).toBe(false);
    expect(token.warnings).toEqual([]);
  });

  it('keeps each segment as it arrived, so a page can show the split', () => {
    const raw = build({ alg: 'none' }, { sub: '1' }, '');
    const token = tokenOf(raw);

    expect(`${token.header.raw}.${token.payload.raw}.${token.signature.raw}`).toBe(raw);
  });

  it('counts the claims it has nothing to say about', () => {
    const token = tokenOf(build({ alg: 'RS256' }, { iss: 'https://issuer.example', tenant: 'acme', region: 'eu' }));

    expect(token.claims.map((claim) => claim.name)).toEqual(['iss']);
    expect(token.otherClaimCount).toBe(2);
  });

  it('refuses an empty box and an absurd amount of text', () => {
    expect(failureOf('   ').error.message).toContain('Paste a token');
    expect(failureOf('a'.repeat(maximumJwtLength + 1)).error.message).toContain('64 KB');
  });

  it('says which of the three parts is wrong', () => {
    const badPayload = `${segment({ alg: 'HS256' })}.not!a!segment.${signature}`;
    const failure = failureOf(badPayload);

    expect(failure.error.segment).toBe('payload');
    expect(failure.error.message).toContain('not Base64URL');
    // The header read perfectly well, so it comes back with the complaint.
    expect(failure.partial?.header?.value).toEqual({ alg: 'HS256' });
  });

  it('names an empty segment rather than reporting invalid Base64', () => {
    const failure = failureOf(`.${segment({ sub: '1' })}.${signature}`);

    expect(failure.error.segment).toBe('header');
    expect(failure.error.message).toContain('nothing between the dots');
  });

  it('tells a JWE apart from a JWT instead of failing on its parts', () => {
    expect(failureOf('a.b.c.d.e').error.message).toContain('encrypted token');
  });

  it('explains two parts as a truncated or unsigned token', () => {
    const failure = failureOf(`${segment({ alg: 'HS256' })}.${segment({ sub: '1' })}`);

    expect(failure.error.message).toContain('ends with a dot');
  });

  it('sends something with no dots at all to the Gizlet that reads plain Base64', () => {
    expect(failureOf('Zm9vYmFy').error.message).toContain('Base64 Encode & Decode');
    expect(failureOf('a.b.c.d').error.message).toContain('4');
  });

  it('reports a segment that decodes to something other than JSON', () => {
    const notJson = Buffer.from('hello there', 'utf8').toString('base64url');
    const notObject = Buffer.from('[1, 2, 3]', 'utf8').toString('base64url');
    const notText = Buffer.from([0xff, 0xfe, 0x00, 0x01]).toString('base64url');

    expect(failureOf(`${segment({ alg: 'HS256' })}.${notJson}.${signature}`).error.message).toContain('is not JSON');
    expect(failureOf(`${segment({ alg: 'HS256' })}.${notObject}.${signature}`).error.message).toContain(
      'a list rather than an object',
    );
    expect(failureOf(`${segment({ alg: 'HS256' })}.${notText}.${signature}`).error.message).toContain('not text');
  });

  it('recognises a nested token rather than complaining that it is not JSON', () => {
    const inner = build({ alg: 'HS256' }, { sub: '1' });
    const outer = `${segment({ alg: 'HS256', cty: 'JWT' })}.${Buffer.from(inner, 'utf8').toString('base64url')}.${signature}`;
    const failure = failureOf(outer);

    expect(failure.error.message).toContain('payload is another token');
    expect(failure.partial?.header?.value).toEqual({ alg: 'HS256', cty: 'JWT' });
  });
});

describe('the warnings, which never hide the answer', () => {
  it('says an unsigned token proves nothing', () => {
    const token = tokenOf(build({ alg: 'none' }, { sub: '1' }, ''));

    expect(token.signature.empty).toBe(true);
    expect(token.warnings.join(' ')).toContain('proves nothing');
  });

  it('calls out alg none with a signature attached', () => {
    const token = tokenOf(build({ alg: 'none' }, { sub: '1' }));

    expect(token.warnings.join(' ')).toContain('downgrade attack');
  });

  it('calls out a missing signature under a real algorithm', () => {
    const token = tokenOf(build({ alg: 'RS256' }, { sub: '1' }, ''));

    expect(token.warnings.join(' ')).toContain('truncated');
  });

  it('calls out a header with no algorithm in it', () => {
    const token = tokenOf(build({ typ: 'JWT' }, { sub: '1' }));

    expect(token.algorithm).toBeUndefined();
    expect(token.warnings.join(' ')).toContain('names no algorithm');
  });

  it('mentions padding and the wrong alphabet without refusing the token', () => {
    const paddedHeader = Buffer.from(JSON.stringify({ alg: 'HS256', kid: 'k' }), 'utf8').toString('base64');

    expect(paddedHeader).toMatch(/=$/);

    const token = tokenOf(`${paddedHeader}.${segment({ sub: '1' })}.${signature}`);

    expect(token.header.value).toEqual({ alg: 'HS256', kid: 'k' });
    expect(token.warnings.join(' ')).toContain('= padding');
  });

  it('mentions the standard alphabet where a token used it', () => {
    // These bytes encode to a segment carrying a + in the standard alphabet.
    const standard = Buffer.from(JSON.stringify({ alg: 'HS256', kid: 'ÿ¿ï' }), 'utf8').toString('base64');

    expect(standard).toMatch(/[+/]/);

    const token = tokenOf(`${standard.replace(/=+$/, '')}.${segment({ sub: '1' })}.${signature}`);

    expect(token.warnings.join(' ')).toContain('standard Base64 alphabet');
  });

  it('mentions a typ this Gizlet does not expect', () => {
    const token = tokenOf(build({ alg: 'HS256', typ: 'JOSE' }, { sub: '1' }));

    expect(token.warnings.join(' ')).toContain('typ is JOSE');
  });

  it('says a signature that will not decode is unreadable rather than failing', () => {
    const token = tokenOf(build({ alg: 'HS256' }, { sub: '1' }, 'not!a!signature'));

    expect(token.signature.byteLength).toBeUndefined();
    expect(token.warnings.join(' ')).toContain('signature is not Base64URL');
  });

  it('catches milliseconds in a date that is supposed to be seconds', () => {
    const token = tokenOf(build({ alg: 'HS256' }, { exp: nowSeconds * 1000 }));

    expect(token.warnings.join(' ')).toContain('that is milliseconds');
    expect(token.claims[0]?.time?.looksLikeMilliseconds).toBe(true);
  });

  it('catches a date written as a string', () => {
    const token = tokenOf(build({ alg: 'HS256' }, { exp: '1789254000' }));

    expect(token.claims[0]?.time).toBeUndefined();
    expect(token.warnings.join(' ')).toContain('a plain number of seconds');
  });

  it('catches a token that expires before it was issued', () => {
    const token = tokenOf(build({ alg: 'HS256' }, { iat: nowSeconds, exp: nowSeconds - 60 }));

    expect(token.warnings.join(' ')).toContain('expires before it was issued');
  });
});

describe('the claim readings', () => {
  it('reads every registered claim in one fixed order, with its meaning', () => {
    const payload = Object.fromEntries(
      jwtRegisteredClaims.map((definition) => [definition.name, definition.time === true ? nowSeconds : 'x']),
    );
    const token = tokenOf(build({ alg: 'HS256' }, payload));

    expect(token.claims.map((claim) => claim.name)).toEqual(jwtRegisteredClaims.map((claim) => claim.name));

    for (const claim of token.claims) {
      expect(claim.label).not.toBe('');
      expect(claim.meaning.length).toBeGreaterThan(30);
    }
  });

  it('writes a value back exactly as it arrived', () => {
    const token = tokenOf(build({ alg: 'HS256' }, { aud: ['one', 'two'], sub: '1234', nonce: 7 }));
    const raw = new Map(token.claims.map((claim) => [claim.name, claim.raw]));

    expect(raw.get('aud')).toBe('["one","two"]');
    expect(raw.get('sub')).toBe('1234');
    expect(raw.get('nonce')).toBe('7');
    expect(formatJwtValue(null)).toBe('null');
    expect(formatJwtValue(false)).toBe('false');
  });

  it('gives a time claim both the number and the moment', () => {
    const token = tokenOf(build({ alg: 'HS256' }, { iat: nowSeconds }));
    const [issued] = token.claims;

    expect(issued?.raw).toBe(String(nowSeconds));
    expect(issued?.time?.seconds).toBe(nowSeconds);
    expect(issued?.time?.utc).toBe('2026-09-07 09:15:00 UTC');
  });

  it('reads only what a NumericDate can be', () => {
    expect(readJwtTime('1789254000')).toBeUndefined();
    expect(readJwtTime(Number.NaN)).toBeUndefined();
    expect(readJwtTime(0)?.utc).toBe('1970-01-01 00:00:00 UTC');
    expect(readJwtClaims({ nothing: 'here' })).toEqual([]);
  });

  it('writes a moment no calendar can hold as words rather than as a date', () => {
    expect(formatJwtInstant(new Date(Number.NaN))).toContain('too far away');
  });
});

describe('getJwtWindow', () => {
  const windowOf = (payload: Record<string, unknown>) => getJwtWindow(tokenOf(build({ alg: 'HS256' }, payload)), now);

  it('reports an expiry that has passed', () => {
    const expired = windowOf({ exp: nowSeconds - 3600 });

    expect(expired.state).toBe('expired');
    expect(expired.summary).toContain('1 hour ago');
    expect(expired.summary).toContain('2026-09-07 08:15:00 UTC');
  });

  it('reports a token that is not to be used yet', () => {
    const early = windowOf({ nbf: nowSeconds + 3600, exp: nowSeconds + 7200 });

    expect(early.state).toBe('early');
    expect(early.summary).toContain('in 1 hour');
  });

  it('reports an expiry still ahead without calling the token valid', () => {
    const open = windowOf({ iat: nowSeconds - 60, exp: nowSeconds + 1800 });

    expect(open.state).toBe('within');
    expect(open.summary).toContain('in 30 minutes');
    expect(open.summary.toLowerCase()).not.toContain('valid');
  });

  it('says plainly when a token sets no expiry at all', () => {
    const open = windowOf({ sub: '1' });

    expect(open.state).toBe('unstated');
    expect(open.summary).toContain('sets no expiry');
  });

  it('ignores an expiry it has already reported as milliseconds', () => {
    // Read as seconds it is fifty thousand years out, so calling the token in
    // date would be repeating the token's own mistake back to the reader.
    const unreadable = windowOf({ exp: nowSeconds * 1000 });

    expect(unreadable.state).toBe('unstated');
    expect(unreadable.summary).toContain('not a date this can read');
  });

  it('labels every state without ever labelling one valid', () => {
    expect(Object.keys(jwtWindowLabels).sort()).toEqual(['early', 'expired', 'unstated', 'within']);
    expect(Object.values(jwtWindowLabels).join(' ')).not.toContain('VALID');
  });
});

describe('cleanJwtInput', () => {
  it('takes a token out of whatever it was copied from', () => {
    const token = build({ alg: 'HS256' }, { sub: '1' });

    expect(cleanJwtInput(`Bearer ${token}`).token).toBe(token);
    expect(cleanJwtInput(`Authorization: Bearer ${token}`).token).toBe(token);
    expect(cleanJwtInput(`"${token}",`).token).toBe(token);
    expect(cleanJwtInput(`${token.slice(0, 20)}\n  ${token.slice(20)}`).token).toBe(token);
  });

  it('says what it ignored, rather than silently rewriting the input', () => {
    const token = build({ alg: 'HS256' }, { sub: '1' });
    const { notes } = cleanJwtInput(`Authorization: Bearer ${token.slice(0, 10)}\n${token.slice(10)}`);

    expect(notes).toHaveLength(3);
    expect(notes.join(' ')).toContain('Bearer prefix was ignored');
    expect(cleanJwtInput(token).notes).toEqual([]);
  });

  it('decodes a token that arrived inside a header, prefix and all', () => {
    const token = tokenOf(`Authorization: Bearer ${build({ alg: 'HS256' }, { sub: '1' })}`);

    expect(token.payload.value).toEqual({ sub: '1' });
    expect(token.warnings.join(' ')).toContain('Bearer prefix was ignored');
  });
});

describe('what the page says about a token', () => {
  it('summarises the header, the named parameters and the signature length', () => {
    const token = tokenOf(build({ alg: 'RS256', typ: 'JWT', kid: 'key-1' }, { sub: '1' }));

    expect(describeJwtHeader(token)).toBe('RS256 · typ JWT · kid key-1 · 22-byte signature');
    expect(describeJwtHeader(tokenOf(build({ alg: 'none' }, { sub: '1' }, '')))).toBe('none · no signature');
    expect(describeJwtHeader(tokenOf(build({ typ: 'JWT' }, { sub: '1' })))).toContain('no algorithm named');
  });

  it('explains the algorithms whose names look interchangeable and are not', () => {
    expect(getJwtAlgorithmNote('HS256')).toContain('share');
    expect(getJwtAlgorithmNote('RS256')).toContain('only the issuer');
    expect(getJwtAlgorithmNote('none')).toContain('proves nothing');
    expect(getJwtAlgorithmNote('HS128')).toBeUndefined();
  });

  it('keeps the one claim it must never make out of its own copy', () => {
    expect(getJwtNotVerifiedNote()).toContain('Decoding is not verifying');
    expect(getJwtSignatureNote()).toContain('needs the issuer’s key');

    for (const definition of [...jwtRegisteredClaims, ...jwtHeaderParameters]) {
      expect(definition.meaning).not.toMatch(/\bthis token is valid\b/i);
    }
  });
});
