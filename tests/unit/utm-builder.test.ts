import { describe, expect, it } from 'vitest';

import {
  buildCampaignUrl,
  describeCampaignUrl,
  describeDestinationProblem,
  emptyUtmValues,
  getMixedCaseFields,
  parseDestination,
  utmFieldDetails,
  utmFields,
  utmParameters,
  type UtmValues,
} from '../../src/data/utm-builder';

const required: UtmValues = { ...emptyUtmValues, source: 'newsletter', medium: 'email', campaign: 'launch' };

/** The built address, or a failure that names why, so a broken case reads clearly. */
function built(destination: string, values: Partial<UtmValues> = {}): string {
  const result = buildCampaignUrl(destination, { ...required, ...values });

  if (!result.ok) throw new Error(`Expected a link, got ${JSON.stringify(result)}`);

  return result.url;
}

/** What an analytics script reading the finished link would see. */
const readBack = (url: string) => new URL(url).searchParams;

describe('the fields', () => {
  it('describes every field it writes, in the order it writes them', () => {
    expect(utmFieldDetails.map((detail) => detail.field)).toEqual([...utmFields]);
    expect(utmParameters).toEqual(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']);
    expect(utmFieldDetails.filter((detail) => detail.required).map((detail) => detail.field)).toEqual([
      'source',
      'medium',
      'campaign',
    ]);
  });
});

describe('parseDestination', () => {
  it('accepts absolute http and https addresses', () => {
    expect(parseDestination('https://example.com/shop').ok).toBe(true);
    expect(parseDestination('  http://example.com  ').ok).toBe(true);
  });

  it.each([
    ['javascript:alert(1)', 'javascript'],
    ['JavaScript:alert(document.cookie)', 'javascript'],
    ['data:text/html,<script>alert(1)</script>', 'data'],
    ['mailto:someone@example.com', 'mailto'],
    ['ftp://example.com/file', 'ftp'],
    ['file:///etc/passwd', 'file'],
  ])('refuses %s, which is not a web page', (input, scheme) => {
    expect(parseDestination(input)).toEqual({ ok: false, problem: { kind: 'unsupported-scheme', scheme } });
  });

  it.each(['/pricing', '//example.com/pricing', '?utm_source=x', '#top', 'pricing', 'not a url at all'])(
    'refuses the relative or partial address %s',
    (input) => {
      const result = parseDestination(input);

      expect(result.ok).toBe(false);
      expect(!result.ok && result.problem.kind).toBe('not-absolute');
    },
  );

  it('suggests https:// for a bare host, and never for a path', () => {
    expect(parseDestination('example.com/shop')).toEqual({
      ok: false,
      problem: { kind: 'not-absolute', suggestion: 'https://example.com/shop' },
    });
    expect(parseDestination('example.com:8080/shop')).toEqual({
      ok: false,
      problem: { kind: 'not-absolute', suggestion: 'https://example.com:8080/shop' },
    });
    expect(parseDestination('/shop')).toEqual({ ok: false, problem: { kind: 'not-absolute' } });
    expect(parseDestination('localhost:3000')).toEqual({ ok: false, problem: { kind: 'not-absolute' } });
  });

  it('says the destination is missing rather than wrong when nothing is typed', () => {
    expect(parseDestination('   ')).toEqual({ ok: false, problem: { kind: 'empty' } });
  });

  it('names the scheme it refused', () => {
    expect(describeDestinationProblem({ kind: 'unsupported-scheme', scheme: 'javascript' })).toContain(
      'A javascript: link is not a web page',
    );
    expect(describeDestinationProblem({ kind: 'not-absolute', suggestion: 'https://example.com/' })).toContain(
      'https://example.com/',
    );
  });
});

describe('buildCampaignUrl', () => {
  it('adds the three required parameters to a bare address', () => {
    expect(built('https://example.com/shop')).toBe(
      'https://example.com/shop?utm_source=newsletter&utm_medium=email&utm_campaign=launch',
    );
  });

  it('keeps the existing query as written, and the fragment at the end', () => {
    expect(built('https://example.com/shop?ref=home&sort=price%20asc&flag#reviews')).toBe(
      'https://example.com/shop?ref=home&sort=price%20asc&flag&utm_source=newsletter&utm_medium=email&utm_campaign=launch#reviews',
    );
  });

  it('keeps a fragment when there was no query', () => {
    expect(built('https://example.com/#/pricing?tab=2')).toBe(
      'https://example.com/?utm_source=newsletter&utm_medium=email&utm_campaign=launch#/pricing?tab=2',
    );
  });

  it('replaces a managed key the address already had, and says so', () => {
    const result = buildCampaignUrl('https://example.com/?utm_source=old&id=7&utm_campaign=spring', required);

    expect(result).toMatchObject({
      ok: true,
      url: 'https://example.com/?id=7&utm_source=newsletter&utm_medium=email&utm_campaign=launch',
      replaced: ['utm_source', 'utm_campaign'],
      removed: [],
      duplicatesDropped: 0,
    });
    expect(describeCampaignUrl(result)).toContain('Replaced the utm_source and utm_campaign');
  });

  it('writes each managed key exactly once however many times it was repeated', () => {
    const result = buildCampaignUrl(
      'https://example.com/?utm_source=a&utm_source=b&utm%5Fsource=c&utm_medium=x&utm_medium=y',
      required,
    );

    expect(result.ok).toBe(true);

    if (!result.ok) return;

    const params = readBack(result.url);

    for (const parameter of utmParameters) {
      expect(params.getAll(parameter).length, parameter).toBeLessThanOrEqual(1);
    }

    expect(params.get('utm_source')).toBe('newsletter');
    expect(params.get('utm_medium')).toBe('email');
    expect(result.duplicatesDropped).toBe(3);
    expect(describeCampaignUrl(result)).toContain('3 repeated utm_ keys were dropped');
  });

  it('leaves keys that only look like managed ones alone', () => {
    expect(built('https://example.com/?UTM_SOURCE=keep&utm_id=9&my_utm_source=keep')).toBe(
      'https://example.com/?UTM_SOURCE=keep&utm_id=9&my_utm_source=keep&utm_source=newsletter&utm_medium=email&utm_campaign=launch',
    );
  });

  it('writes nothing for an empty optional field, and removes the old value under its key', () => {
    const result = buildCampaignUrl('https://example.com/?utm_term=old+term&utm_content=banner', {
      ...required,
      term: '   ',
      content: 'footer',
    });

    expect(result).toMatchObject({
      ok: true,
      url: 'https://example.com/?utm_source=newsletter&utm_medium=email&utm_campaign=launch&utm_content=footer',
      replaced: ['utm_content'],
      removed: ['utm_term'],
    });
    expect(describeCampaignUrl(result)).toContain('Removed the old utm_term');
  });

  it('writes the optional fields after the required ones when they are filled in', () => {
    expect(built('https://example.com/', { term: 'shoes', content: 'cta' })).toBe(
      'https://example.com/?utm_source=newsletter&utm_medium=email&utm_campaign=launch&utm_term=shoes&utm_content=cta',
    );
  });

  it('escapes spaces as %20 and trims the ends of each value', () => {
    const url = built('https://example.com/', { campaign: '  autumn launch 2026 ', term: 'running shoes' });

    expect(url).toContain('utm_campaign=autumn%20launch%202026');
    expect(url).toContain('utm_term=running%20shoes');
    expect(url).not.toContain('+');
    expect(readBack(url).get('utm_campaign')).toBe('autumn launch 2026');
  });

  it('keeps an ampersand, an equals sign, a plus and a hash inside the value they belong to', () => {
    const url = built('https://example.com/?a=1', { campaign: 'salt & pepper = 1+1 #win' });

    expect(url).toContain('utm_campaign=salt%20%26%20pepper%20%3D%201%2B1%20%23win');
    expect(readBack(url).get('utm_campaign')).toBe('salt & pepper = 1+1 #win');
    expect(readBack(url).get('a')).toBe('1');
    expect(new URL(url).hash).toBe('');
  });

  it('writes Unicode values as UTF-8 escapes and reads them back intact', () => {
    const url = built('https://example.com/', { source: 'café', campaign: 'été 🍂', content: '日本語' });

    expect(url).toContain('utm_source=caf%C3%A9');
    expect(url).toContain('utm_campaign=%C3%A9t%C3%A9%20%F0%9F%8D%82');
    expect(readBack(url).get('utm_source')).toBe('café');
    expect(readBack(url).get('utm_campaign')).toBe('été 🍂');
    expect(readBack(url).get('utm_content')).toBe('日本語');
  });

  it('accepts a Unicode destination, which the browser writes in its own encoded form', () => {
    const url = built('https://bücher.example/straße?q=ä');

    expect(url.startsWith('https://xn--bcher-kva.example/stra%C3%9Fe?q=%C3%A4&utm_source=newsletter')).toBe(true);
  });

  it('names every missing required field, in order', () => {
    const result = buildCampaignUrl('https://example.com/', { ...emptyUtmValues, medium: 'email' });

    expect(result).toEqual({ ok: false, missing: ['source', 'campaign'] });
    expect(describeCampaignUrl(result)).toBe('Add a source and a campaign to build the link.');
  });

  it('asks for the destination along with the fields when nothing is filled in', () => {
    const result = buildCampaignUrl('', emptyUtmValues);

    expect(describeCampaignUrl(result)).toBe('Add a destination, a source, a medium and a campaign to build the link.');
  });

  it.each(['javascript:alert(1)//?x', 'data:text/html,hi', '/relative/path', 'example.com'])(
    'builds nothing from %s, however complete the fields are',
    (destination) => {
      const result = buildCampaignUrl(destination, { ...required, term: 't', content: 'c' });

      expect(result.ok).toBe(false);
      expect(!result.ok && result.destination?.kind).toMatch(/not-absolute|unsupported-scheme/);
      expect(describeCampaignUrl(result)).toBe('Fix the destination address to build the link.');
    },
  );

  it('says the link was built locally', () => {
    expect(describeCampaignUrl(buildCampaignUrl('https://example.com/', required))).toBe(
      'Built on this device. Nothing was opened or fetched.',
    );
  });
});

describe('getMixedCaseFields', () => {
  it('points out a capital letter, since most reports count Newsletter and newsletter apart', () => {
    expect(getMixedCaseFields({ ...required, source: 'Newsletter', content: 'Été' })).toEqual(['source', 'content']);
    expect(getMixedCaseFields(required)).toEqual([]);
  });
});
