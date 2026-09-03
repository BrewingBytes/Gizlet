import { describe, expect, it } from 'vitest';

import {
  decodeRecipe,
  encodeRecipe,
  maximumRecipeLength,
  maximumRecipeSteps,
  type Recipe,
} from '../../src/data/recipes';
import { maximumImageDimension } from '../../src/data/image-resize';

const fullRecipe: Recipe = {
  outputFormat: 'image/webp',
  steps: [
    { toolSlug: 'resize-image', width: 800, height: 600 },
    { toolSlug: 'compress-image', quality: 80 },
    { toolSlug: 'convert-image' },
  ],
};

describe('decodeRecipe', () => {
  it('reads a chain, its order, and every per-step setting', () => {
    expect(decodeRecipe('#r=v1;f=webp;resize-image:w=800,h=600;compress-image:q=80;convert-image')).toEqual(
      fullRecipe,
    );
  });

  it('reads a fragment with or without its leading hash', () => {
    expect(decodeRecipe('r=v1;compress-image:q=60')).toEqual({
      outputFormat: undefined,
      steps: [{ toolSlug: 'compress-image', quality: 60 }],
    });
  });

  it('falls back to the default builder rather than applying part of a recipe', () => {
    // Anything that does not parse and validate returns undefined, whole.
    expect(decodeRecipe('')).toBeUndefined();
    expect(decodeRecipe('#')).toBeUndefined();
    expect(decodeRecipe('#resize-image:w=800,h=600')).toBeUndefined();
    expect(decodeRecipe('#r=v2;compress-image:q=80')).toBeUndefined();
    expect(decodeRecipe('#r=v1')).toBeUndefined();
    expect(decodeRecipe('#r=v1;f=webp')).toBeUndefined();
  });

  it('rejects a slug that is unknown, unavailable, or cannot run in an image flow', () => {
    expect(decodeRecipe('#r=v1;merge-pdf:q=80')).toBeUndefined();
    expect(decodeRecipe('#r=v1;json-formatter')).toBeUndefined();
    expect(decodeRecipe('#r=v1;json-ld-generator;json-formatter')).toBeUndefined();
  });

  it('rejects a key that is not whitelisted for that Gizlet', () => {
    expect(decodeRecipe('#r=v1;compress-image:w=800')).toBeUndefined();
    expect(decodeRecipe('#r=v1;convert-image:q=80')).toBeUndefined();
    expect(decodeRecipe('#r=v1;resize-image:w=800,h=600,q=80')).toBeUndefined();
    expect(decodeRecipe('#r=v1;resize-image:w=800,w=900')).toBeUndefined();
  });

  it('rejects a value outside its validator, reusing the resize and quality rules', () => {
    expect(decodeRecipe(`#r=v1;resize-image:w=${maximumImageDimension + 1},h=10`)).toBeUndefined();
    expect(decodeRecipe('#r=v1;resize-image:w=8000,h=8000')).toBeUndefined(); // above 40 million pixels
    expect(decodeRecipe('#r=v1;resize-image:w=0,h=10')).toBeUndefined();
    expect(decodeRecipe('#r=v1;compress-image:q=39')).toBeUndefined();
    expect(decodeRecipe('#r=v1;compress-image:q=101')).toBeUndefined();
    expect(decodeRecipe('#r=v1;f=gif;convert-image')).toBeUndefined();
  });

  it('rejects a malformed value rather than coercing it', () => {
    expect(decodeRecipe('#r=v1;compress-image:q=80.5')).toBeUndefined();
    expect(decodeRecipe('#r=v1;compress-image:q=+80')).toBeUndefined();
    expect(decodeRecipe('#r=v1;compress-image:q=-80')).toBeUndefined();
    expect(decodeRecipe('#r=v1;compress-image:q=')).toBeUndefined();
    expect(decodeRecipe('#r=v1;compress-image:q')).toBeUndefined();
    expect(decodeRecipe('#r=v1;compress-image:q=8=0')).toBeUndefined();
    expect(decodeRecipe('#r=v1;compress-image:q=80:extra')).toBeUndefined();
  });

  it('rejects half a resize, because a partly applied step is the failure this format avoids', () => {
    expect(decodeRecipe('#r=v1;resize-image:w=800')).toBeUndefined();
    expect(decodeRecipe('#r=v1;resize-image:h=600')).toBeUndefined();
    expect(decodeRecipe('#r=v1;resize-image')).toEqual({
      outputFormat: undefined,
      steps: [{ toolSlug: 'resize-image' }],
    });
  });

  it('rejects a chain the executable compatibility graph does not allow', () => {
    expect(decodeRecipe('#r=v1;json-formatter;compress-image')).toBeUndefined();
  });

  it('enforces the step and length caps', () => {
    const withinCap = `r=v1;${Array(maximumRecipeSteps).fill('convert-image').join(';')}`;
    const overCap = `r=v1;${Array(maximumRecipeSteps + 1).fill('convert-image').join(';')}`;

    expect(decodeRecipe(withinCap)?.steps).toHaveLength(maximumRecipeSteps);
    expect(decodeRecipe(overCap)).toBeUndefined();
    expect('r=v1;convert-image'.padEnd(maximumRecipeLength + 1, ';convert-image').length).toBeGreaterThan(
      maximumRecipeLength,
    );
    expect(decodeRecipe(`r=v1;${'convert-image;'.repeat(60)}convert-image`)).toBeUndefined();
  });
});

describe('encodeRecipe', () => {
  it('round-trips a recipe through its own format', () => {
    const encoded = encodeRecipe(fullRecipe);

    expect(encoded).toBe('#r=v1;f=webp;resize-image:w=800,h=600;compress-image:q=80;convert-image');
    expect(decodeRecipe(encoded ?? '')).toEqual(fullRecipe);
  });

  it('omits a format the flow has not chosen', () => {
    expect(encodeRecipe({ steps: [{ toolSlug: 'convert-image' }] })).toBe('#r=v1;convert-image');
  });

  it('produces no link at all rather than one that cannot be read back', () => {
    expect(encodeRecipe({ steps: [] })).toBeUndefined();
    expect(
      encodeRecipe({ steps: Array(maximumRecipeSteps + 1).fill({ toolSlug: 'convert-image' }) }),
    ).toBeUndefined();
    expect(
      encodeRecipe({ steps: [{ toolSlug: 'resize-image', width: 0, height: 10 }] }),
    ).toBeUndefined();
    expect(
      encodeRecipe({ steps: [{ toolSlug: 'compress-image', quality: 80.5 }] }),
    ).toBeUndefined();
  });
});

describe('the settings-only guarantee', () => {
  it('cannot emit a value that would break out of its own delimiters', () => {
    // Every whitelisted value is a whole number or a closed enum, which is why
    // the format needs no percent-encoding. This asserts that property directly.
    const delimiters = ['#', ';', ':', ',', '='];
    const recipes: Recipe[] = [
      fullRecipe,
      { outputFormat: 'image/jpeg', steps: [{ toolSlug: 'resize-image', width: 16384, height: 1 }] },
      { outputFormat: 'image/png', steps: [{ toolSlug: 'compress-image', quality: 40 }] },
    ];

    for (const recipe of recipes) {
      const encoded = encodeRecipe(recipe);

      expect(encoded).toBeDefined();

      const values = (encoded ?? '').slice(1).split(';').flatMap((segment) => {
        const settings = segment.slice(segment.indexOf(':') + 1);
        return settings.split(',').map((pair) => pair.slice(pair.indexOf('=') + 1));
      });

      for (const value of values) {
        for (const delimiter of delimiters) {
          expect(value).not.toContain(delimiter);
        }
      }
    }
  });

  it('has no key that could carry file content, a filename, or a URL', () => {
    // The whitelist is the enforcement. Anything not setting-shaped is unreadable.
    expect(decodeRecipe('#r=v1;convert-image:name=holiday.jpg')).toBeUndefined();
    expect(decodeRecipe('#r=v1;convert-image:src=https://example.com/a.jpg')).toBeUndefined();
    expect(decodeRecipe('#r=v1;convert-image:data=AAAA')).toBeUndefined();
  });
});
