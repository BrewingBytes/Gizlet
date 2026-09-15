import { describe, expect, it } from 'vitest';
import { getPlannedTools } from '../../src/data/tools';
import { searchTools } from '../../src/scripts/tool-search';

describe('searchTools', () => {
  it('matches a tool by multi-word intent across its name and keywords', () => {
    expect(searchTools('compress photo').map((tool) => tool.name)).toEqual(['Compress Image']);
  });

  it('ranks Compress Image first for someone working to a file-size limit', () => {
    // The person with an upload form in front of them does not search for
    // "compress": they search for the number the form refused.
    for (const query of [
      'target file size',
      'compress to kb',
      'image size limit',
      'under 1mb',
      'compress image to 500 kb',
    ]) {
      expect(searchTools(query).map((tool) => tool.name)[0], query).toBe('Compress Image');
    }
  });

  it('matches schema terminology from the registry keywords', () => {
    expect(searchTools('schema').map((tool) => tool.name)).toEqual(['JSON-LD Generator']);
  });

  it('ranks Image to PDF first for its old name and every supported image format', () => {
    for (const query of [
      'jpg to pdf',
      'image to pdf',
      'png to pdf',
      'webp to pdf',
      'avif to pdf',
      'bmp to pdf',
    ]) {
      expect(searchTools(query).map((tool) => tool.name)[0]).toBe('Image to PDF');
    }
  });

  it('ranks the converter first when a query names two image formats', () => {
    for (const query of ['jpg to png', 'png to jpg', 'jpg to webp', 'avif to jpg']) {
      expect(searchTools(query).map((tool) => tool.name)[0]).toBe('Convert Image');
    }
  });

  it('ignores connector words so they cannot outweigh the terms that matter', () => {
    expect(searchTools('to')).toEqual([]);
  });

  it('answers the question the field asks, verb and all', () => {
    // The field is labelled "I need to…", so a query arrives with the words a
    // catalogue of nouns cannot contain. Each of these returned nothing while
    // every term had to match: the site's own JSON-LD Generator was unreachable
    // by the most natural way to ask for it.
    const first = (query: string) => searchTools(query).map((tool) => tool.name)[0];

    expect(first('structured data')).toBe('JSON-LD Generator');
    expect(first('schema markup')).toBe('JSON-LD Generator');
    expect(first('make JSON-LD')).toBe('JSON-LD Generator');
    expect(first('write JSON-LD')).toBe('JSON-LD Generator');
    expect(first('add structured data')).toBe('JSON-LD Generator');
    expect(first('format JSON')).toBe('JSON Formatter');
    expect(first('format my JSON')).toBe('JSON Formatter');
    expect(first('tidy JSON')).toBe('JSON Formatter');
    expect(first('i need to compress a photo')).toBe('Compress Image');
    expect(first('crop my photo')).toBe('Crop Image');
    expect(first('make a collage')).toBe('Collage Maker');
  });

  it('keeps a loose partial match out, which is what the old rule was for', () => {
    // Resize Image and Collage Maker both know "photo", and neither answers as
    // much of this query as the Gizlet that knows both words.
    expect(searchTools('compress photo').map((tool) => tool.name)).toEqual(['Compress Image']);
    expect(searchTools('resize an image').map((tool) => tool.name)).toEqual(['Resize Image']);
  });

  it('refuses a query one weak term would otherwise carry', () => {
    // "maker" begins with "make" and nothing here knows what a QR code is, so a
    // single matched term out of three is not an answer to the question.
    expect(searchTools('make a qr code')).toEqual([]);
  });

  it('matches a word rather than the letters inside one', () => {
    // "peg" sat inside "jpeg" and "son" inside "json", which is how "a" and
    // "an" used to match every Gizlet on the site.
    expect(searchTools('peg')).toEqual([]);
    expect(searchTools('son')).toEqual([]);
    expect(searchTools('mage')).toEqual([]);
    // A word still matches from its start, because the field is searched as it
    // is typed and a half-typed word is the normal case.
    expect(searchTools('compres').map((tool) => tool.name)[0]).toBe('Compress Image');
  });

  it('returns no results for a blank or unmatched query', () => {
    expect(searchTools('')).toEqual([]);
    // A word a visitor might plausibly try and that no Gizlet claims. It has
    // to be replaced whenever one starts claiming it, which is what happened
    // to “spreadsheet” when the JSON and CSV Converter shipped.
    expect(searchTools('translate')).toEqual([]);
  });

  it('offers only Gizlets that exist, because a result is a link about to be followed', () => {
    // A result carries a path rather than a slug, and a path is what a visitor
    // would follow, so the routes are what has to stay out of the results.
    const plannedPaths = new Set<string>(getPlannedTools().map((tool) => tool.path));

    for (const tool of getPlannedTools()) {
      for (const query of [tool.name, ...tool.keywords]) {
        expect(
          searchTools(query).filter((result) => plannedPaths.has(result.path)),
          `${tool.slug}: ${query}`,
        ).toEqual([]);
      }
    }

    expect(getPlannedTools().length).toBeGreaterThan(0);
  });
});
