import { decodeBase64, describeBase64Error, fromUtf8 } from './base64';

/**
 * A JSON Web Token taken apart, and deliberately not checked.
 *
 * Decoding a JWT and verifying one are different jobs, and only the first can
 * honestly be done here. The header and the payload are Base64URL — anyone can
 * read them, which is the whole point of this Gizlet — but the signature is a
 * claim about who wrote them, and testing that claim needs the key. A shared
 * secret would have to be typed into this page; a public key would have to be
 * fetched from the issuer. Neither is something a page that promises to send
 * nothing anywhere is going to do.
 *
 * So everything here reads. Nothing here trusts. The words `valid` and
 * `verified` do not appear in the copy this module produces, because a person
 * skim-reading a token inspector will take either of them as "this token is
 * fine", and this page cannot know that. What it can say is what the token
 * says about itself, which is a different sentence and the honest one.
 *
 * The Base64URL half is not written again: `base64.ts` already reads both
 * alphabets, ignores whitespace, copes with missing padding, and reports the
 * character it choked on. A JWT segment is exactly that job, so this module
 * calls it and spends its own effort on what a token means.
 */

/** How much text this reads at once. Real tokens are a kilobyte or two. */
export const maximumJwtLength = 64 * 1024;

/**
 * A token to look at, for a visitor who arrived without one.
 *
 * It expired in June 2025 on purpose: an example with an expiry in the future
 * would quietly become an expired one on whatever day it passed, and this way
 * the page demonstrates the expiry reading rather than being embarrassed by
 * it. The signature is thirty-two bytes of nothing in particular, which is the
 * honest thing for an example on a page that never checks one.
 */
export const sampleJwt =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmV4YW1wbGUuY29tIiwic3ViIjoiYTFiMmMzZDQtMGY5ZS00ZDJiLThjN2EtNTFlNmYwZDM5YjQyIiwiYXVkIjoiZ2l6bGV0LWV4YW1wbGUiLCJuYW1lIjoiQWRhIExvdmVsYWNlIiwic2NvcGUiOiJyZWFkOm5vdGVzIHdyaXRlOm5vdGVzIiwiaWF0IjoxNzQ5OTAwMDAwLCJuYmYiOjE3NDk5MDAwMDAsImV4cCI6MTc0OTkwMzYwMCwianRpIjoiOWYyYzFlN2E0YiJ9.CzBVep_E6RM4XYKnzPEbQGWKr9T5I0htkrfcBitQdZo';

/** The three parts of a signed token, in the order they are written. */
export type JwtSegmentName = 'header' | 'payload' | 'signature';

export interface JwtDecodeError {
  readonly message: string;
  /** Which part is at fault, when the fault belongs to one part. */
  readonly segment?: JwtSegmentName;
}

export interface JwtSegmentReading {
  readonly name: 'header' | 'payload';
  /** The Base64URL exactly as it arrived, for a page that shows the split. */
  readonly raw: string;
  /** The JSON it held, indented, which is what a reader actually looks at. */
  readonly json: string;
  readonly value: Readonly<Record<string, unknown>>;
}

export interface JwtSignatureReading {
  readonly raw: string;
  /** How many bytes it decoded to, when it decoded at all. */
  readonly byteLength?: number;
  /** An `alg: none` token ends with a dot and nothing after it. */
  readonly empty: boolean;
}

export interface DecodedJwt {
  readonly header: JwtSegmentReading;
  readonly payload: JwtSegmentReading;
  readonly signature: JwtSignatureReading;
  /** What the header says signed it, when it says. Not what did sign it. */
  readonly algorithm?: string;
  /** The registered claims the payload carries, in a fixed reading order. */
  readonly claims: readonly JwtClaimReading[];
  /** How many payload keys are not registered claims, so the table can say so. */
  readonly otherClaimCount: number;
  /**
   * Things worth telling the reader that are not failures.
   *
   * A token can be malformed in ways that leave it perfectly readable — `=`
   * padding a JWT is not supposed to carry, a missing signature, an `exp`
   * written in milliseconds. Refusing those would hide the answer behind the
   * complaint, so they are said alongside the answer instead.
   */
  readonly warnings: readonly string[];
}

export type JwtDecodeResult =
  | { readonly ok: true; readonly token: DecodedJwt }
  | {
      readonly ok: false;
      readonly error: JwtDecodeError;
      /**
       * What was readable before the trouble.
       *
       * A payload that is not JSON does not make the header unreadable, and a
       * page that blanks both is a page that threw away the half that worked.
       */
      readonly partial?: { readonly header?: JwtSegmentReading };
    };

/**
 * What a registered claim or header parameter is for.
 *
 * The three-letter names are the reason this Gizlet exists: `iss`, `nbf` and
 * `azp` are not guessable, and looking each one up in RFC 7519 is the work the
 * page is meant to save. Only the names defined by a specification are here —
 * everything else in a token belongs to whoever issued it, and inventing a
 * meaning for `tenant_id` would be worse than saying nothing.
 */
export interface JwtFieldDefinition {
  readonly name: string;
  readonly label: string;
  readonly meaning: string;
  /** Whether the value is a NumericDate: seconds since 1970, not milliseconds. */
  readonly time?: true;
}

/**
 * RFC 7519's registered claims, then the OpenID Connect ones people meet daily.
 *
 * Annotated rather than `as const satisfies`, for the reason `roadmap.ts` is:
 * only some entries carry `time`, and a literal tuple type makes that field
 * unreachable on the union everything here iterates. The array is still
 * checked against the interface, which is the guarantee that matters.
 */
export const jwtRegisteredClaims: readonly JwtFieldDefinition[] = [
  {
    name: 'iss',
    label: 'Issuer',
    meaning: 'Who says they made this token. A name or a URL, and only meaningful once the signature has been checked against that issuer’s key.',
  },
  {
    name: 'sub',
    label: 'Subject',
    meaning: 'Who or what the token is about — usually the user, as an id rather than a name.',
  },
  {
    name: 'aud',
    label: 'Audience',
    meaning: 'Who the token was made for. A service given a token whose audience is somebody else is supposed to refuse it.',
  },
  {
    name: 'azp',
    label: 'Authorised party',
    meaning: 'The client the token was issued to, when that is not the same as the audience. From OpenID Connect rather than RFC 7519.',
  },
  {
    name: 'exp',
    label: 'Expires',
    meaning: 'The moment after which the token is not supposed to be accepted. Enforcing that is the receiver’s job, and this page does not enforce anything.',
    time: true,
  },
  {
    name: 'nbf',
    label: 'Not before',
    meaning: 'The moment before which the token is not supposed to be accepted. Usually absent, which means "from the moment it was issued".',
    time: true,
  },
  {
    name: 'iat',
    label: 'Issued at',
    meaning: 'When the token was made. Worth comparing with the expiry to see how long a token like this lives.',
    time: true,
  },
  {
    name: 'auth_time',
    label: 'Authenticated at',
    meaning: 'When the person actually logged in, which can be long before the token was issued. From OpenID Connect.',
    time: true,
  },
  {
    name: 'jti',
    label: 'Token id',
    meaning: 'A unique id for this token, so a receiver can refuse to accept the same one twice.',
  },
  {
    name: 'scope',
    label: 'Scope',
    meaning: 'What the bearer is being permitted to do, as space-separated names. An OAuth 2 convention, not a registered claim.',
  },
  {
    name: 'nonce',
    label: 'Nonce',
    meaning: 'A value the client sent when it asked for the token, so it can tell that the answer belongs to its own request.',
  },
];

/** The JOSE header parameters worth naming when a token carries one. */
export const jwtHeaderParameters: readonly JwtFieldDefinition[] = [
  {
    name: 'alg',
    label: 'Algorithm',
    meaning: 'What the header says was used to sign the token. It is a claim like any other: an attacker can write whatever they like here, which is why a receiver decides the algorithm rather than believing this field.',
  },
  {
    name: 'typ',
    label: 'Type',
    meaning: 'What kind of token this is. Almost always JWT, and increasingly at+jwt for an OAuth access token.',
  },
  {
    name: 'cty',
    label: 'Content type',
    meaning: 'What the payload holds, when it is not JSON claims. JWT here means the payload is another token.',
  },
  {
    name: 'kid',
    label: 'Key id',
    meaning: 'Which of the issuer’s keys signed this, so a receiver knows which one to check it against.',
  },
  {
    name: 'jku',
    label: 'Key set URL',
    meaning: 'Where the issuer publishes its keys. Nothing here fetches it: this page contacts no issuer.',
  },
  {
    name: 'x5t',
    label: 'Certificate thumbprint',
    meaning: 'A digest of the certificate whose key signed the token, as another way of naming it.',
  },
  {
    name: 'crit',
    label: 'Critical',
    meaning: 'Header parameters a receiver must understand or else reject the token outright.',
  },
];

/**
 * The common signing algorithms, said in one line each.
 *
 * `HS256` and `RS256` look interchangeable and are not: one is a shared secret
 * that both sides hold, and the other is a signature only the issuer could
 * have made. That difference decides whether a token can be forged by whoever
 * can verify it, so it is worth a sentence on the page.
 */
const algorithmNotes: Readonly<Record<string, string>> = {
  none: 'Unsigned. The token says nobody signed it, so it proves nothing whatsoever about where it came from.',
  HS256: 'HMAC with SHA-256: a secret both sides share. Anyone who can check this token can also make one.',
  HS384: 'HMAC with SHA-384: a secret both sides share. Anyone who can check this token can also make one.',
  HS512: 'HMAC with SHA-512: a secret both sides share. Anyone who can check this token can also make one.',
  RS256: 'RSA with SHA-256: signed with a private key and checked with the matching public one, so only the issuer could have made it.',
  RS384: 'RSA with SHA-384: signed with a private key and checked with the matching public one.',
  RS512: 'RSA with SHA-512: signed with a private key and checked with the matching public one.',
  PS256: 'RSA-PSS with SHA-256: the modern RSA padding, checked with the issuer’s public key.',
  PS384: 'RSA-PSS with SHA-384: the modern RSA padding, checked with the issuer’s public key.',
  PS512: 'RSA-PSS with SHA-512: the modern RSA padding, checked with the issuer’s public key.',
  ES256: 'ECDSA on P-256 with SHA-256: an elliptic-curve signature, checked with the issuer’s public key.',
  ES384: 'ECDSA on P-384 with SHA-384: an elliptic-curve signature, checked with the issuer’s public key.',
  ES512: 'ECDSA on P-521 with SHA-512: an elliptic-curve signature, checked with the issuer’s public key.',
  EdDSA: 'Edwards-curve signature, usually Ed25519, checked with the issuer’s public key.',
};

/** What an algorithm name means, when it is one this knows. */
export function getJwtAlgorithmNote(algorithm: string): string | undefined {
  return algorithmNotes[algorithm];
}

/**
 * The token, freed from what it was pasted out of.
 *
 * Tokens arrive inside other things: a copied `Authorization` header, a line
 * of JSON with quotes and a comma, a log wrapped across three lines. Refusing
 * those would be refusing the commonest input this Gizlet will ever get, so
 * they are stripped and the reader is told what was ignored.
 */
export function cleanJwtInput(input: string): { readonly token: string; readonly notes: readonly string[] } {
  const notes: string[] = [];
  let text = input.trim();

  const header = /^authorization\s*:\s*/i.exec(text);

  if (header) {
    text = text.slice(header[0].length).trim();
    notes.push('The Authorization header name was ignored.');
  }

  const bearer = /^bearer\s+/i.exec(text);

  if (bearer) {
    text = text.slice(bearer[0].length).trim();
    notes.push('The Bearer prefix was ignored.');
  }

  // A token lifted out of JSON keeps its quotes, and sometimes its comma.
  const quoted = /^"(.*)"[,;]?$/s.exec(text);

  if (quoted) {
    text = quoted[1].trim();
    notes.push('The surrounding quotes were ignored.');
  }

  const withoutSpace = text.replace(/\s+/g, '');

  if (withoutSpace !== text) {
    notes.push('Line breaks and spaces inside the token were ignored.');
  }

  return { token: withoutSpace, notes };
}

/** A single readable segment, once its bytes are known to be JSON. */
function readSegment(name: 'header' | 'payload', raw: string, value: Record<string, unknown>): JwtSegmentReading {
  return { name, raw, json: JSON.stringify(value, undefined, 2), value };
}

type SegmentResult =
  | { readonly ok: true; readonly reading: JwtSegmentReading; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly error: JwtDecodeError };

const segmentLabels = {
  header: 'header',
  payload: 'payload',
  signature: 'signature',
} as const satisfies Record<JwtSegmentName, string>;

/**
 * One Base64URL segment read as a JSON object.
 *
 * Every failure names the segment, because "invalid token" is the error this
 * Gizlet exists to replace: a person with a token that will not decode needs
 * to know which third of it is the problem before anything else.
 */
function decodeSegment(name: 'header' | 'payload', raw: string): SegmentResult {
  const label = segmentLabels[name];

  if (raw === '') {
    return {
      ok: false,
      error: {
        segment: name,
        message: `The ${label} is empty — there is nothing between the dots. A token with an empty ${label} was cut somewhere along the way.`,
      },
    };
  }

  const warnings: string[] = [];
  const decoded = decodeBase64(raw);

  if (!decoded.ok) {
    return {
      ok: false,
      error: {
        segment: name,
        message: `The ${label} is not Base64URL. ${describeBase64Error(decoded.error)}`,
      },
    };
  }

  if (decoded.reading.alphabet === 'standard' && /[+/]/.test(raw)) {
    warnings.push(
      `The ${label} uses + or /, which is the standard Base64 alphabet. A JWT is always written in the URL-safe one, with - and _, so this token has been through something that re-encoded it.`,
    );
  }

  if (decoded.reading.padded) {
    warnings.push(
      `The ${label} carries = padding. A JWT is defined without it, so a strict library will refuse this token even though the bytes are fine.`,
    );
  }

  const text = fromUtf8(decoded.reading.bytes);

  if (text === undefined) {
    return {
      ok: false,
      error: {
        segment: name,
        message: `The ${label} decodes to bytes that are not text, so it cannot be the JSON a JWT ${label} has to be. This is Base64 of something else.`,
      },
    };
  }

  let value: unknown;

  try {
    value = JSON.parse(text);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : 'it is not JSON';

    return {
      ok: false,
      error: {
        segment: name,
        message: `The ${label} decoded, but what came out is not JSON: ${detail}`,
      },
    };
  }

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      error: {
        segment: name,
        message: `The ${label} is JSON, but a ${Array.isArray(value) ? 'list' : typeof value} rather than an object. A JWT ${label} is always a set of named fields.`,
      },
    };
  }

  return { ok: true, reading: readSegment(name, raw, value as Record<string, unknown>), warnings };
}

/** How a claim's value is written back out, in one line, exactly as it arrived. */
export function formatJwtValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);

  return String(value);
}

export interface JwtTimeReading {
  /** The number the token wrote, which is what a bug report needs. */
  readonly seconds: number;
  /** The same moment in UTC, which is unambiguous everywhere. */
  readonly utc: string;
  /**
   * Whether the number is far too large to be seconds.
   *
   * A NumericDate is seconds since 1970, and the single commonest mistake in a
   * hand-rolled token is `Date.now()`, which is milliseconds. It parses, it
   * looks plausible, and it puts the expiry fifty thousand years out.
   */
  readonly looksLikeMilliseconds: boolean;
}

/** A NumericDate read as a moment, or nothing when it is not a number at all. */
export function readJwtTime(value: unknown): JwtTimeReading | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;

  // Anything past the year 5000 in seconds is a millisecond value by mistake,
  // and the reading says so rather than printing a date nobody will live to see.
  const looksLikeMilliseconds = value > 100_000_000_000;
  const moment = new Date(value * 1000);

  return {
    seconds: value,
    utc: formatJwtInstant(moment),
    looksLikeMilliseconds,
  };
}

/** `2026-09-07 09:15:00 UTC`, because a token's dates belong to no timezone. */
export function formatJwtInstant(moment: Date): string {
  if (Number.isNaN(moment.getTime())) return 'a date too far away to write down';

  const pad = (part: number, width = 2) => String(part).padStart(width, '0');

  return `${pad(moment.getUTCFullYear(), 4)}-${pad(moment.getUTCMonth() + 1)}-${pad(moment.getUTCDate())} ${pad(moment.getUTCHours())}:${pad(moment.getUTCMinutes())}:${pad(moment.getUTCSeconds())} UTC`;
}

const gapUnits = [
  { limit: 45 * 60, divisor: 60, name: 'minute' },
  { limit: 36 * 3600, divisor: 3600, name: 'hour' },
  { limit: 45 * 86400, divisor: 86400, name: 'day' },
  { limit: 550 * 86400, divisor: 30 * 86400, name: 'month' },
] as const;

/**
 * How far a moment is from now, in words.
 *
 * The clock is a parameter rather than a call to `Date.now()` inside here: a
 * function that reads the time is a function whose tests are either flaky or
 * elaborate, and every caller has a clock to hand anyway.
 */
export function describeJwtTimeGap(seconds: number, now: number): string {
  const difference = seconds - Math.floor(now / 1000);
  const magnitude = Math.abs(difference);

  if (magnitude < 30) return difference >= 0 ? 'in a moment' : 'moments ago';

  const unit = gapUnits.find((candidate) => magnitude < candidate.limit);
  const count = unit
    ? Math.round(magnitude / unit.divisor)
    : Math.round((magnitude / (365 * 86400)) * 10) / 10;
  const name = unit ? unit.name : 'year';
  const text = `${count.toLocaleString()} ${name}${count === 1 ? '' : 's'}`;

  return difference >= 0 ? `in ${text}` : `${text} ago`;
}

export interface JwtClaimReading {
  readonly name: string;
  readonly label: string;
  readonly meaning: string;
  /** The value written out as it arrived, never reformatted into something else. */
  readonly raw: string;
  /** The reading of a NumericDate claim, when the value really is one. */
  readonly time?: JwtTimeReading;
}

/** The registered claims a payload carries, in the order they are worth reading. */
export function readJwtClaims(value: Readonly<Record<string, unknown>>): readonly JwtClaimReading[] {
  const readings: JwtClaimReading[] = [];

  for (const definition of jwtRegisteredClaims) {
    if (!Object.hasOwn(value, definition.name)) continue;

    const claim = value[definition.name];
    const time = definition.time === true ? readJwtTime(claim) : undefined;

    readings.push({
      name: definition.name,
      label: definition.label,
      meaning: definition.meaning,
      raw: formatJwtValue(claim),
      ...(time ? { time } : {}),
    });
  }

  return readings;
}

/** What the header says, as one line of metadata under the token. */
export function describeJwtHeader(token: DecodedJwt): string {
  const parts: string[] = [token.algorithm ?? 'no algorithm named'];

  for (const definition of jwtHeaderParameters) {
    if (definition.name === 'alg') continue;
    if (!Object.hasOwn(token.header.value, definition.name)) continue;

    parts.push(`${definition.name} ${formatJwtValue(token.header.value[definition.name])}`);
  }

  if (token.signature.empty) parts.push('no signature');
  else if (token.signature.byteLength !== undefined) {
    parts.push(`${token.signature.byteLength.toLocaleString()}-byte signature`);
  }

  return parts.join(' · ');
}

/**
 * A token taken apart.
 *
 * No clock is read here on purpose, so the result is the same whenever it runs
 * and a test can assert on all of it. Everything that depends on the time of
 * day — whether an expiry has passed, how long ago a token was issued — is a
 * separate call the caller makes with its own `now`.
 */
export function decodeJwt(input: string): JwtDecodeResult {
  if (input.trim() === '') {
    return { ok: false, error: { message: 'Paste a token to read it.' } };
  }

  if (input.length > maximumJwtLength) {
    return {
      ok: false,
      error: {
        message: `That is longer than any JWT has business being — the limit here is ${Math.round(maximumJwtLength / 1024)} KB. A token this size is usually a whole log file pasted by accident.`,
      },
    };
  }

  const { token: text, notes } = cleanJwtInput(input);
  const segments = text.split('.');

  if (segments.length === 5) {
    return {
      ok: false,
      error: {
        message:
          'This is an encrypted token — a JWE, which has five parts rather than three. Its payload is ciphertext, so there is nothing to read without the key, and this page has no keys and asks for none.',
      },
    };
  }

  if (segments.length === 2) {
    return {
      ok: false,
      error: {
        message:
          'A JWT has three parts separated by two dots, and this has two parts. Either the signature was cut off when the token was copied, or the token is unsigned — an unsigned one still ends with a dot, with nothing after it.',
      },
    };
  }

  if (segments.length !== 3) {
    return {
      ok: false,
      error: {
        message:
          segments.length === 1
            ? 'There are no dots in this, so it is not a JWT. A token is three Base64URL parts with dots between them; if what you have is plain Base64, the Base64 Encode & Decode Gizlet reads that.'
            : `A JWT has three parts separated by two dots, and this has ${segments.length.toLocaleString()}. Two tokens pasted together do this, as does a token with a dot added to it.`,
      },
    };
  }

  const [rawHeader, rawPayload, rawSignature] = segments;
  const header = decodeSegment('header', rawHeader);

  if (!header.ok) return { ok: false, error: header.error };

  const payload = decodeSegment('payload', rawPayload);

  if (!payload.ok) {
    const cty = header.reading.value.cty;
    const nested =
      typeof cty === 'string' && cty.toUpperCase() === 'JWT'
        ? {
            segment: 'payload' as const,
            message:
              'The header says cty is JWT, which means the payload is another token rather than a set of claims. Paste the payload segment on its own to read the token inside.',
          }
        : undefined;

    // The header read perfectly well, so it is handed back with the complaint
    // rather than thrown away because the next segment was broken.
    return { ok: false, error: nested ?? payload.error, partial: { header: header.reading } };
  }

  const warnings = [...notes, ...header.warnings, ...payload.warnings];
  const algorithm = typeof header.reading.value.alg === 'string' ? header.reading.value.alg : undefined;
  const signature = readSignature(rawSignature, algorithm, warnings);

  if (algorithm === undefined) {
    warnings.push(
      'The header names no algorithm. Every JWT is supposed to carry alg, and a receiver that reads this token will most likely refuse it.',
    );
  }

  const typ = header.reading.value.typ;

  if (typeof typ === 'string' && !/^(jwt|at\+jwt|application\/at\+jwt)$/i.test(typ)) {
    warnings.push(`The header says typ is ${typ}, which is not the JWT this Gizlet reads. The parts decoded anyway.`);
  }

  warnings.push(...readTimeWarnings(payload.reading.value));

  return {
    ok: true,
    token: {
      header: header.reading,
      payload: payload.reading,
      signature,
      ...(algorithm ? { algorithm } : {}),
      claims: readJwtClaims(payload.reading.value),
      otherClaimCount: countOtherClaims(payload.reading.value),
      warnings,
    },
  };
}

/**
 * The signature, measured rather than checked.
 *
 * Nothing here can tell a real signature from sixty-four random bytes, so the
 * only honest facts about it are how long it is and whether it is there at all.
 * A signature that will not even decode is a warning rather than a failure: the
 * header and the claims are still perfectly readable, and hiding them behind a
 * complaint about the third segment would be the wrong trade.
 */
function readSignature(raw: string, algorithm: string | undefined, warnings: string[]): JwtSignatureReading {
  const unsigned = algorithm !== undefined && algorithm.toLowerCase() === 'none';

  if (raw === '') {
    if (unsigned) {
      warnings.push(
        'This token says it is unsigned: alg is none and there is nothing after the last dot. Anybody can write one of these and change anything in it, so it proves nothing about who made it.',
      );
    } else {
      warnings.push(
        `There is nothing after the last dot, so the token carries no signature — but the header claims ${algorithm ?? 'an algorithm'}. Something has truncated this token.`,
      );
    }

    return { raw, empty: true };
  }

  if (unsigned) {
    warnings.push(
      'The header says alg is none, yet there is a signature here. That combination is what a downgrade attack looks like, and a receiver should refuse it outright.',
    );
  }

  const decoded = decodeBase64(raw);

  if (!decoded.ok) {
    warnings.push(`The signature is not Base64URL. ${describeBase64Error(decoded.error)}`);

    return { raw, empty: false };
  }

  return { raw, byteLength: decoded.reading.bytes.length, empty: false };
}

/** Time claims that are the wrong sort of value, or in the wrong order. */
function readTimeWarnings(value: Readonly<Record<string, unknown>>): readonly string[] {
  const warnings: string[] = [];

  for (const definition of jwtRegisteredClaims) {
    if (definition.time !== true) continue;
    if (!Object.hasOwn(value, definition.name)) continue;

    const claim = value[definition.name];
    const time = readJwtTime(claim);

    if (!time) {
      warnings.push(
        `${definition.name} is ${formatJwtValue(claim)}, and a JWT date is a plain number of seconds. A string here is a common mistake and a strict receiver will reject it.`,
      );
      continue;
    }

    if (time.looksLikeMilliseconds) {
      warnings.push(
        `${definition.name} is ${time.seconds.toLocaleString()}, which is too large to be seconds — that is milliseconds, as Date.now() gives them. Divided by a thousand it reads as ${formatJwtInstant(new Date(time.seconds))}.`,
      );
    }
  }

  const expiry = readJwtTime(value.exp);
  const issued = readJwtTime(value.iat);

  if (expiry && issued && expiry.seconds < issued.seconds) {
    warnings.push('The token expires before it was issued, so exp and iat are the wrong way round or one of them is wrong.');
  }

  return warnings;
}

/** How many payload keys this module has nothing to say about. */
function countOtherClaims(value: Readonly<Record<string, unknown>>): number {
  const known = new Set(jwtRegisteredClaims.map((definition) => definition.name));

  return Object.keys(value).filter((key) => !known.has(key)).length;
}

/**
 * Where the token's own window stands against a clock.
 *
 * Every sentence here is about what the token says, never about whether it
 * would be accepted. A receiver checks the signature, the audience, the issuer
 * and its own revocation list, and any of those can reject a token whose dates
 * are perfectly current — so `within` is deliberately not called valid.
 */
export type JwtWindowState = 'expired' | 'early' | 'within' | 'unstated';

export interface JwtWindow {
  readonly state: JwtWindowState;
  readonly summary: string;
}

export function getJwtWindow(token: DecodedJwt, now: number): JwtWindow {
  // A date the token got wrong is not a date to reason about. An exp written
  // in milliseconds would otherwise put every such token comfortably in date,
  // which is repeating the token's own mistake back to the reader as reassurance.
  const expiry = usableTime(token.payload.value.exp);
  const start = usableTime(token.payload.value.nbf);
  const seconds = Math.floor(now / 1000);

  if (expiry && expiry.seconds <= seconds) {
    return {
      state: 'expired',
      summary: `The token’s own expiry passed ${describeJwtTimeGap(expiry.seconds, now)}, at ${expiry.utc}.`,
    };
  }

  if (start && start.seconds > seconds) {
    return {
      state: 'early',
      summary: `The token says it is not to be used before ${start.utc}, which is ${describeJwtTimeGap(start.seconds, now)}.`,
    };
  }

  if (!expiry) {
    return {
      state: 'unstated',
      summary: Object.hasOwn(token.payload.value, 'exp')
        ? 'The exp claim is not a date this can read, so nothing here says when the token stops being accepted. The note above says what is wrong with it.'
        : 'The token sets no expiry, so nothing in it says when it should stop being accepted.',
    };
  }

  return {
    state: 'within',
    summary: `The token’s own expiry is ${describeJwtTimeGap(expiry.seconds, now)}, at ${expiry.utc}.`,
  };
}

/** A date claim only when it is one a clock can be compared against. */
function usableTime(value: unknown): JwtTimeReading | undefined {
  const time = readJwtTime(value);

  return time && !time.looksLikeMilliseconds ? time : undefined;
}

/** How the window is labelled, in the mono voice the rest of the page uses. */
export const jwtWindowLabels = {
  expired: 'EXPIRED',
  early: 'NOT YET',
  within: 'IN DATE',
  unstated: 'NO EXPIRY',
} as const satisfies Record<JwtWindowState, string>;

/**
 * The sentence this whole Gizlet is built around.
 *
 * It is a function rather than a string in a component so that the page, the
 * tests and the copy elsewhere cannot drift into three different versions of
 * the one claim that matters.
 */
export function getJwtNotVerifiedNote(): string {
  return 'Decoding is not verifying. This page reads what the token says about itself; it does not check the signature, the issuer or the audience, and it cannot tell a genuine token from one somebody wrote by hand.';
}

/** Why the signature is shown but not tested. */
export function getJwtSignatureNote(): string {
  return 'Checking this signature needs the issuer’s key: a shared secret you would have to type in, or a public key this page would have to fetch. Neither belongs on a page that sends nothing anywhere, so the signature is shown as it arrived and left alone.';
}
