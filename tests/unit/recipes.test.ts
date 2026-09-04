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
  category: 'images',
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
      category: 'images',
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
      category: 'images',
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

describe('a PDF flow in a recipe', () => {
  const pdfRecipe: Recipe = {
    category: 'images',
    outputFormat: 'image/jpeg',
    steps: [
      { toolSlug: 'resize-image', width: 1200, height: 1200 },
      { toolSlug: 'jpg-to-pdf', pageSize: 'letter', orientation: 'landscape' },
    ],
  };

  it('round-trips the page size and orientation', () => {
    const encoded = encodeRecipe(pdfRecipe);

    expect(encoded).toBe('#r=v1;f=jpeg;resize-image:w=1200,h=1200;jpg-to-pdf:p=letter,o=landscape');
    expect(decodeRecipe(encoded ?? '')).toEqual(pdfRecipe);
  });

  it('writes the defaults rather than a step the builder would rebuild differently', () => {
    expect(encodeRecipe({ steps: [{ toolSlug: 'jpg-to-pdf' }] })).toBe(
      '#r=v1;jpg-to-pdf:p=a4,o=auto',
    );
  });

  it('accepts a bare PDF step, which the builder fills with its own defaults', () => {
    expect(decodeRecipe('#r=v1;jpg-to-pdf')).toEqual({
      category: 'images',
      outputFormat: undefined,
      steps: [{ toolSlug: 'jpg-to-pdf' }],
    });
  });

  it('rejects a page size or orientation outside its closed list', () => {
    expect(decodeRecipe('#r=v1;jpg-to-pdf:p=a3,o=auto')).toBeUndefined();
    expect(decodeRecipe('#r=v1;jpg-to-pdf:p=a4,o=sideways')).toBeUndefined();
    expect(decodeRecipe('#r=v1;jpg-to-pdf:p=A4,o=auto')).toBeUndefined();
    expect(decodeRecipe('#r=v1;jpg-to-pdf:p=,o=auto')).toBeUndefined();
  });

  it('rejects a key the PDF Gizlet does not accept, and a number where a name belongs', () => {
    expect(decodeRecipe('#r=v1;jpg-to-pdf:q=80')).toBeUndefined();
    expect(decodeRecipe('#r=v1;jpg-to-pdf:p=1,o=auto')).toBeUndefined();
    expect(decodeRecipe('#r=v1;resize-image:p=a4,h=10')).toBeUndefined();
  });

  it('rejects half the page layout, for the same reason it rejects half a resize', () => {
    expect(decodeRecipe('#r=v1;jpg-to-pdf:p=letter')).toBeUndefined();
    expect(decodeRecipe('#r=v1;jpg-to-pdf:o=portrait')).toBeUndefined();
  });

  /**
   * 0.3.0 offered a PDF Viewer block, so a link written by it can name that
   * step. The block did nothing and has been removed, and an unreadable recipe
   * is ignored whole rather than in part — which is this format's documented
   * behaviour, not a new failure. No alias is kept: the window is one release
   * long, and reviving the slug would mean reviving a step that never ran.
   */
  it('ignores a 0.3.0 link that names the removed PDF Viewer block', () => {
    expect(decodeRecipe('#r=v1;jpg-to-pdf:p=a4,o=auto;pdf-viewer')).toBeUndefined();
    expect(decodeRecipe('#r=v1;pdf-viewer')).toBeUndefined();
  });

  it('rejects a chain that continues past the PDF, which nothing can read yet', () => {
    expect(decodeRecipe('#r=v1;jpg-to-pdf;compress-image')).toBeUndefined();
    expect(
      encodeRecipe({
        steps: [{ toolSlug: 'jpg-to-pdf' }, { toolSlug: 'compress-image' }],
      }),
    ).toBeUndefined();
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

describe('a crop in a recipe', () => {
  it('carries the shape rather than a rectangle', () => {
    const encoded = encodeRecipe({
      steps: [{ toolSlug: 'crop-image', ratio: '16:9' }, { toolSlug: 'compress-image', quality: 70 }],
    });

    expect(encoded).toBe('#r=v1;crop-image:a=16x9;compress-image:q=70');
    expect(decodeRecipe(encoded ?? '')?.steps).toEqual([
      { toolSlug: 'crop-image', ratio: '16:9' },
      { toolSlug: 'compress-image', quality: 70 },
    ]);
  });

  it('defaults a crop that names no shape, because a flow has to crop to something', () => {
    expect(encodeRecipe({ steps: [{ toolSlug: 'crop-image' }] })).toBe('#r=v1;crop-image:a=1x1');
    expect(decodeRecipe('#r=v1;crop-image')?.steps).toEqual([{ toolSlug: 'crop-image' }]);
  });

  it('refuses a shape that is not one of the offered ones', () => {
    // Free crop is a rectangle somebody drew, which a link cannot carry.
    expect(decodeRecipe('#r=v1;crop-image:a=free')).toBeUndefined();
    expect(decodeRecipe('#r=v1;crop-image:a=16:9')).toBeUndefined();
    expect(decodeRecipe('#r=v1;crop-image:a=99x1')).toBeUndefined();
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
      { steps: [{ toolSlug: 'jpg-to-pdf', pageSize: 'legal', orientation: 'portrait' }] },
      { steps: [{ toolSlug: 'crop-image', ratio: '9:16' }] },
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
    // The enum keys are whitelists of exact names, not free text.
    expect(decodeRecipe('#r=v1;jpg-to-pdf:p=holiday.jpg,o=auto')).toBeUndefined();
    expect(decodeRecipe('#r=v1;jpg-to-pdf:p=https://example.com,o=auto')).toBeUndefined();
  });
});

describe('a flow that starts from a PDF', () => {
  const splitRecipe: Recipe = {
    category: 'pdf',
    steps: [{ toolSlug: 'split-pdf' }, { toolSlug: 'pdf-to-jpg', resolution: 'print' }],
  };

  it('names its category, because the chain is only valid against that starting payload', () => {
    const encoded = encodeRecipe(splitRecipe);

    expect(encoded).toBe('#r=v1;c=pdf;split-pdf;pdf-to-jpg:r=print');
    expect(decodeRecipe(encoded ?? '')).toEqual({ ...splitRecipe, outputFormat: undefined });
  });

  it('carries a merge, which an image flow has nothing to hand it', () => {
    expect(decodeRecipe('#r=v1;c=pdf;merge-pdf')).toEqual({
      category: 'pdf',
      outputFormat: undefined,
      steps: [{ toolSlug: 'merge-pdf' }],
    });
    expect(decodeRecipe('#r=v1;merge-pdf')).toBeUndefined();
  });

  it('rejects an image chain under the PDF category, and a PDF chain under images', () => {
    expect(decodeRecipe('#r=v1;c=pdf;compress-image:q=80')).toBeUndefined();
    expect(decodeRecipe('#r=v1;c=images;split-pdf')).toBeUndefined();
  });

  it('rejects a category outside the closed list rather than defaulting to images', () => {
    expect(decodeRecipe('#r=v1;c=pdfs;split-pdf')).toBeUndefined();
    expect(decodeRecipe('#r=v1;c=;split-pdf')).toBeUndefined();
    expect(decodeRecipe('#r=v1;c=json;json-formatter')).toBeUndefined();
  });

  /**
   * The token is omitted for the default category, so a link shared before
   * categories existed is still the link this release writes for that flow.
   */
  it('leaves an image flow`s link byte for byte what it was', () => {
    expect(encodeRecipe({ steps: [{ toolSlug: 'convert-image' }] })).toBe('#r=v1;convert-image');
    expect(encodeRecipe({ category: 'images', steps: [{ toolSlug: 'convert-image' }] })).toBe(
      '#r=v1;convert-image',
    );
    expect(decodeRecipe('#r=v1;convert-image')?.category).toBe('images');
  });

  it('still carries no free text: a split names no ranges and a merge no order', () => {
    expect(decodeRecipe('#r=v1;c=pdf;split-pdf:r=1-3')).toBeUndefined();
    expect(decodeRecipe('#r=v1;c=pdf;merge-pdf:n=contract.pdf')).toBeUndefined();
  });
});
