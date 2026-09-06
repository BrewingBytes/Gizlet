import { describe, expect, it } from 'vitest';

import {
  convertUrlText,
  decodeUrlText,
  defaultUrlEncodingMode,
  describeUrlConversion,
  describeUrlDecodeError,
  encodeUrlText,
  findUrlDecodeError,
  getUrlEncodingModeDetail,
  isUrlEncodingDirection,
  isUrlEncodingMode,
  urlEncodingDirections,
  urlEncodingModeDetails,
  urlEncodingModes,
} from '../../src/data/url-encode-decode';

/** Round-tripping is the property that matters, so it is asserted everywhere. */
const roundTrip = (text: string, mode: (typeof urlEncodingModes)[number]) =>
  decodeUrlText(encodeUrlText(text, mode), mode);

describe('the three encodings', () => {
  it('describes every mode it offers, and offers every mode it describes', () => {
    expect(urlEncodingModeDetails.map((detail) => detail.mode)).toEqual([...urlEncodingModes]);
    expect(urlEncodingModes).toContain(defaultUrlEncodingMode);

    for (const detail of urlEncodingModeDetails) {
      expect(detail.label.length).toBeGreaterThan(0);
      expect(detail.summary.length).toBeGreaterThan(40);
    }
  });

  it('recognises a mode and a direction that came from outside', () => {
    expect(isUrlEncodingMode('component')).toBe(true);
    expect(isUrlEncodingMode('form')).toBe(true);
    expect(isUrlEncodingMode('urlencode')).toBe(false);
    expect(isUrlEncodingDirection('decode')).toBe(true);
    expect(isUrlEncodingDirection('sideways')).toBe(false);
    expect(urlEncodingDirections).toEqual(['encode', 'decode']);
  });

  it('falls back to a real mode rather than to nothing', () => {
    expect(getUrlEncodingModeDetail('form').label).toBe('A form field');
    expect(getUrlEncodingModeDetail('component').mode).toBe('component');
  });

  it('escapes everything with a job in a URL when the text is one piece of one', () => {
    expect(encodeUrlText('a&b=c', 'component')).toBe('a%26b%3Dc');
    expect(encodeUrlText('one/two', 'component')).toBe('one%2Ftwo');
    expect(encodeUrlText('a b', 'component')).toBe('a%20b');
    expect(encodeUrlText('#top', 'component')).toBe('%23top');
  });

  it('leaves the structure of a whole URL alone', () => {
    expect(encodeUrlText('https://example.com/a b?x=1&y=2#top', 'url')).toBe(
      'https://example.com/a%20b?x=1&y=2#top',
    );
    // The characters that hold a URL together survive; the ones that break it do not.
    expect(encodeUrlText('a<b>c', 'url')).toBe('a%3Cb%3Ec');
  });

  it('writes a space as a plus for a form field, and escapes what a form escapes', () => {
    expect(encodeUrlText('a b', 'form')).toBe('a+b');
    expect(encodeUrlText("it's (that) ~ok!", 'form')).toBe('it%27s+%28that%29+%7Eok%21');
    // A literal plus is escaped, which is what keeps it from becoming a space.
    expect(encodeUrlText('a+b', 'form')).toBe('a%2Bb');
    // Only these three modes disagree about characters; the rest is the same.
    expect(encodeUrlText('a&b', 'form')).toBe('a%26b');
  });

  it('leaves the unreserved characters alone in every mode', () => {
    for (const mode of urlEncodingModes) {
      expect(encodeUrlText('aZ09-_.', mode)).toBe('aZ09-_.');
    }
  });

  it('escapes an empty string as an empty string', () => {
    for (const mode of urlEncodingModes) {
      expect(encodeUrlText('', mode)).toBe('');
      expect(decodeUrlText('', mode)).toEqual({ ok: true, output: '' });
    }
  });
});

describe('text that is not ASCII', () => {
  it('encodes a character as the bytes of its UTF-8, and reads them back', () => {
    expect(encodeUrlText('é', 'component')).toBe('%C3%A9');
    expect(encodeUrlText('👍', 'component')).toBe('%F0%9F%91%8D');
    expect(encodeUrlText('日本語', 'component')).toBe('%E6%97%A5%E6%9C%AC%E8%AA%9E');

    for (const mode of urlEncodingModes) {
      expect(roundTrip('naïve café 日本語 👍 — ok', mode)).toEqual({
        ok: true,
        output: 'naïve café 日本語 👍 — ok',
      });
    }
  });

  it('survives a round trip through every mode, punctuation and all', () => {
    const text = 'a b&c=d/e?f#g+h%i "j" \'k\' (l) ~m! *n* \n\ttabbed';

    for (const mode of urlEncodingModes) {
      expect(roundTrip(text, mode)).toEqual({ ok: true, output: text });
    }
  });
});

describe('a plus sign, which means two different things', () => {
  it('is a space in a form field and a plus everywhere else', () => {
    expect(decodeUrlText('a+b', 'form')).toEqual({ ok: true, output: 'a b' });
    expect(decodeUrlText('a+b', 'component')).toEqual({ ok: true, output: 'a+b' });
    expect(decodeUrlText('a+b', 'url')).toEqual({ ok: true, output: 'a+b' });
  });

  it('never quietly corrupts base64, which is full of them', () => {
    // The whole reason the plus is not treated as a space outside a form field.
    expect(decodeUrlText('aGVsbG8+d29ybGQ+Pz8/', 'component')).toEqual({
      ok: true,
      output: 'aGVsbG8+d29ybGQ+Pz8/',
    });
  });

  it('reads an escaped plus back as a plus even in a form field', () => {
    expect(decodeUrlText('a%2Bb', 'form')).toEqual({ ok: true, output: 'a+b' });
  });
});

describe('escapes that are wrong', () => {
  it('says where a percent sign runs off the end of the text', () => {
    const failure = decodeUrlText('100%', 'component');

    expect(failure.ok).toBe(false);
    if (failure.ok) return;
    expect(failure.error.position).toBe(3);
    expect(failure.error.excerpt).toBe('%');
    expect(failure.error.message).toContain('%20');
  });

  it('says where a percent sign is not followed by two hexadecimal digits', () => {
    const failure = decodeUrlText('a%ZZb', 'component');

    expect(failure.ok).toBe(false);
    if (failure.ok) return;
    expect(failure.error.position).toBe(1);
    expect(failure.error.excerpt).toBe('%ZZ');
    // It names the fix, because a lone % is nearly always what happened.
    expect(failure.error.message).toContain('%25');
  });

  it('says where a percent sign has only one digit after it', () => {
    const failure = findUrlDecodeError('a%4');

    expect(failure?.position).toBe(1);
    expect(failure?.message).toContain('ends before it finishes');
  });

  it('rejects bytes that are legal escapes and not a character', () => {
    // %C3 begins a two-byte character and %28 cannot continue one.
    const failure = decodeUrlText('%C3%28', 'component');

    expect(failure.ok).toBe(false);
    if (failure.ok) return;
    expect(failure.error.position).toBe(0);
    expect(failure.error.excerpt).toBe('%C3%28');
    expect(failure.error.message).toContain('not a character in UTF-8');
  });

  it('rejects a continuation byte with nothing in front of it', () => {
    const failure = findUrlDecodeError('%A9');

    expect(failure?.message).toContain('cannot begin a character');
    expect(failure?.excerpt).toBe('%A9');
  });

  it('rejects a sequence that stops before it is finished', () => {
    const failure = findUrlDecodeError('%E6%97');

    expect(failure?.message).toContain('needs 3 bytes');
    expect(failure?.position).toBe(0);
  });

  it('rejects an overlong encoding, which is a character smuggled in extra bytes', () => {
    // %C0%AF is a slash written in two bytes rather than one.
    expect(findUrlDecodeError('%C0%AF')).toBeDefined();
    // %E0%80%AF is the same trick in three.
    expect(findUrlDecodeError('%E0%80%AF')).toBeDefined();
    // And the honest spellings still pass.
    expect(findUrlDecodeError('%2F')).toBeUndefined();
  });

  it('rejects half of a surrogate pair, which is not a character either', () => {
    expect(findUrlDecodeError('%ED%A0%80')).toBeDefined();
    // The same lead byte with a legal continuation is a real character.
    expect(findUrlDecodeError('%ED%9F%BF')).toBeUndefined();
  });

  it('rejects a byte above the range UTF-8 reaches', () => {
    expect(findUrlDecodeError('%F5%80%80%80')).toBeDefined();
    expect(findUrlDecodeError('%FF')).toBeDefined();
  });

  it('reads a run broken by ordinary characters as separate runs', () => {
    // Each %C3%A9 is whole; the letters between them do not join them up.
    expect(findUrlDecodeError('%C3%A9-%C3%A9')).toBeUndefined();
    // And a sequence really cut short by a letter is still caught.
    expect(findUrlDecodeError('%C3-%A9')).toBeDefined();
  });

  it('finds the first thing wrong rather than the worst', () => {
    const failure = findUrlDecodeError('ok%20then%ZZ and %C3%28');

    expect(failure?.excerpt).toBe('%ZZ');
  });

  it('accepts text with no escapes at all', () => {
    expect(findUrlDecodeError('nothing to see here')).toBeUndefined();
    expect(decodeUrlText('nothing to see here', 'component')).toEqual({
      ok: true,
      output: 'nothing to see here',
    });
  });

  it('puts the position in a sentence, counted the way a person counts', () => {
    expect(
      describeUrlDecodeError({ message: 'A message.', position: 3, excerpt: '%ZZ' }),
    ).toBe('Character 4, %ZZ: A message.');
  });
});

describe('one entry point for both directions', () => {
  it('encodes and decodes through the same call', () => {
    expect(convertUrlText('a b', 'encode', 'component')).toEqual({ ok: true, output: 'a%20b' });
    expect(convertUrlText('a%20b', 'decode', 'component')).toEqual({ ok: true, output: 'a b' });
    expect(convertUrlText('a%2', 'decode', 'component').ok).toBe(false);
  });

  it('never fails when encoding, whatever it is given', () => {
    for (const mode of urlEncodingModes) {
      expect(convertUrlText('%%% not an escape %', 'encode', mode).ok).toBe(true);
    }
  });
});

describe('what the page says happened', () => {
  it('asks for something when there is nothing', () => {
    expect(describeUrlConversion('', '', 'encode', 'component')).toBe('Type or paste something above.');
  });

  it('says so when the answer is the question', () => {
    expect(describeUrlConversion('plain', 'plain', 'encode', 'component')).toContain(
      'Nothing here needed escaping',
    );
    expect(describeUrlConversion('plain', 'plain', 'decode', 'component')).toContain(
      'no escapes to read back',
    );
  });

  it('counts characters rather than bytes', () => {
    // One emoji is four escapes and one character, and the count says one.
    expect(describeUrlConversion('👍', encodeUrlText('👍', 'component'), 'encode', 'component')).toBe(
      '1 character was escaped.',
    );
    expect(describeUrlConversion('a b&c', encodeUrlText('a b&c', 'component'), 'encode', 'component')).toBe(
      '2 characters were escaped.',
    );
  });

  it('counts a space written as a plus as a character that was escaped', () => {
    expect(describeUrlConversion('a b', 'a+b', 'encode', 'form')).toBe('1 character was escaped.');
  });

  it('counts what a decode read back, pluses included where they count', () => {
    expect(describeUrlConversion('a%20b', 'a b', 'decode', 'component')).toBe('1 escape was read back.');
    expect(describeUrlConversion('a+b%21', 'a b!', 'decode', 'form')).toBe('2 escapes were read back.');
  });
});
