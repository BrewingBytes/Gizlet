import { describe, expect, it } from 'vitest';
import { searchTools } from '../../src/scripts/tool-search';

describe('searchTools', () => {
  it('matches a tool by multi-word intent across its name and keywords', () => {
    expect(searchTools('compress photo').map((tool) => tool.name)).toEqual(['Compress Image']);
  });

  it('matches schema terminology from the registry keywords', () => {
    expect(searchTools('schema').map((tool) => tool.name)).toEqual(['JSON-LD Generator']);
  });

  it('finds Image to PDF by its old name and every supported image format', () => {
    for (const query of [
      'jpg to pdf',
      'image to pdf',
      'png to pdf',
      'webp to pdf',
      'avif to pdf',
      'bmp to pdf',
    ]) {
      expect(searchTools(query).map((tool) => tool.name)).toEqual(['Image to PDF']);
    }
  });

  it('returns no results for a blank or unmatched query', () => {
    expect(searchTools('')).toEqual([]);
    expect(searchTools('spreadsheet')).toEqual([]);
  });
});
