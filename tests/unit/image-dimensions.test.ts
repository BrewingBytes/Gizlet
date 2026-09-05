import { describe, expect, it } from 'vitest';

import {
  describeAspectRatio,
  describeImageDimensions,
  describeImageFormat,
  describeImageShape,
  describeMegapixels,
  getImageFacts,
  getImageShape,
  imageShapeLabels,
  isUsableImageDimensions,
  reduceAspectRatio,
} from '../../src/data/image-dimensions';

const size = (width: number, height: number) => ({ width, height });

describe('reduceAspectRatio', () => {
  it('divides the sides by everything they have in common', () => {
    expect(reduceAspectRatio(size(1920, 1080))).toEqual(size(16, 9));
    expect(reduceAspectRatio(size(4032, 3024))).toEqual(size(4, 3));
    expect(reduceAspectRatio(size(1000, 1000))).toEqual(size(1, 1));
    expect(reduceAspectRatio(size(1080, 1920))).toEqual(size(9, 16));
  });

  it('reports nothing for a size that is not a size', () => {
    expect(reduceAspectRatio(size(0, 100))).toEqual(size(0, 0));
    expect(reduceAspectRatio(size(Number.NaN, 100))).toEqual(size(0, 0));
    expect(isUsableImageDimensions(size(0, 100))).toBe(false);
    expect(isUsableImageDimensions(size(1, 1))).toBe(true);
  });
});

describe('describeAspectRatio', () => {
  it('prints a ratio that reduces small exactly as it is', () => {
    expect(describeAspectRatio(size(1920, 1080))).toBe('16:9');
    expect(describeAspectRatio(size(800, 600))).toBe('4:3');
    expect(describeAspectRatio(size(1000, 1000))).toBe('1:1');
    expect(describeAspectRatio(size(1080, 1350))).toBe('4:5');
  });

  it('names the shape a picture is nearly, rather than dividing it out', () => {
    // 4000x2250 reduces to 32:18, which nobody recognises; 4001x2250 reduces to
    // nothing at all. Both are 16:9 to anyone looking at them.
    expect(describeAspectRatio(size(4001, 2250))).toBe('≈ 16:9');
    expect(describeAspectRatio(size(3999, 3001))).toBe('≈ 4:3');
  });

  it('falls back to a decimal it can stand behind', () => {
    expect(describeAspectRatio(size(1000, 337))).toBe('2.97:1');
    expect(describeAspectRatio(size(337, 1000))).toBe('0.34:1');
  });

  it('says so when there is nothing to describe', () => {
    expect(describeAspectRatio(size(0, 0))).toBe('Unavailable');
  });
});

describe('describeMegapixels', () => {
  it('says what a camera would say', () => {
    expect(describeMegapixels(size(1920, 1080))).toBe('2.1 MP');
    // Past ten, a decimal place is precision nobody asked for.
    expect(describeMegapixels(size(4032, 3024))).toBe('12 MP');
    expect(describeMegapixels(size(8000, 6000))).toBe('48 MP');
    expect(describeMegapixels(size(3000, 2000))).toBe('6.0 MP');
  });

  it('does not round a small picture down to nothing', () => {
    expect(describeMegapixels(size(100, 100))).toBe('Under 0.1 MP');
    expect(describeMegapixels(size(1, 1))).toBe('Under 0.1 MP');
  });
});

describe('the words beside the numbers', () => {
  it('names the shape', () => {
    expect(getImageShape(size(16, 9))).toBe('landscape');
    expect(getImageShape(size(9, 16))).toBe('portrait');
    expect(getImageShape(size(9, 9))).toBe('square');
    expect(describeImageShape(size(16, 9))).toBe(imageShapeLabels.landscape);
    expect(describeImageShape(size(0, 0))).toBe('Unavailable');
  });

  it('writes the dimensions the way they are pasted into a form', () => {
    expect(describeImageDimensions(size(1920, 1080))).toBe('1920 × 1080');
    expect(describeImageDimensions(size(0, 5))).toBe('Unavailable');
  });

  it('names the format the way the format is written', () => {
    expect(describeImageFormat('image/jpeg')).toBe('JPEG');
    expect(describeImageFormat('image/png')).toBe('PNG');
    expect(describeImageFormat('image/webp')).toBe('WebP');
    expect(describeImageFormat('image/avif')).toBe('AVIF');
    expect(describeImageFormat('image/bmp')).toBe('BMP');
    expect(describeImageFormat(undefined)).toBe('Unrecognised');
  });
});

describe('getImageFacts', () => {
  const facts = getImageFacts(size(1920, 1080), { format: 'image/png', size: '1.2 MB' });

  it('leads with the two lines a visitor came to copy', () => {
    expect(facts.slice(0, 2)).toEqual([
      { label: 'Dimensions', value: '1920 × 1080', copyable: true },
      { label: 'Aspect ratio', value: '16:9', copyable: true },
    ]);
  });

  it('offers a copy only for a value somebody pastes somewhere', () => {
    const copyable = facts.filter((fact) => fact.copyable).map((fact) => fact.label);

    expect(copyable).toEqual(['Dimensions', 'Aspect ratio', 'Width', 'Height']);
    // "Landscape" is read, not pasted.
    expect(facts.find((fact) => fact.label === 'Shape')?.copyable).toBe(false);
  });

  it('reports the file’s own details alongside the picture’s', () => {
    expect(facts.find((fact) => fact.label === 'Format')?.value).toBe('PNG');
    expect(facts.find((fact) => fact.label === 'File size')?.value).toBe('1.2 MB');
    expect(facts.find((fact) => fact.label === 'Megapixels')?.value).toBe('2.1 MP');
  });
});
