import { describe, expect, it } from 'vitest';

import {
  addToColourHistory,
  clampRgb,
  clampToImage,
  colourHistoryLimit,
  describePickedColour,
  fromHex,
  getColourValues,
  prefersDarkText,
  toHex,
  toHsl,
  toHslString,
  toRgbString,
} from '../../src/data/image-colour';

const rgb = (red: number, green: number, blue: number) => ({ red, green, blue });

describe('writing a colour out', () => {
  it('writes hex the way a stylesheet takes it', () => {
    expect(toHex(rgb(255, 255, 255))).toBe('#ffffff');
    expect(toHex(rgb(0, 0, 0))).toBe('#000000');
    expect(toHex(rgb(246, 165, 0))).toBe('#f6a500');
    // Single digits are padded, which is the bug this catches.
    expect(toHex(rgb(1, 2, 3))).toBe('#010203');
  });

  it('writes rgb and hsl the way CSS takes them', () => {
    expect(toRgbString(rgb(246, 165, 0))).toBe('rgb(246, 165, 0)');
    expect(toHslString(rgb(246, 165, 0))).toBe('hsl(40, 100%, 48%)');
  });

  it('keeps a channel inside the range whatever arrived', () => {
    expect(clampRgb(rgb(-10, 300, 12.6))).toEqual(rgb(0, 255, 13));
    expect(clampRgb(rgb(Number.NaN, 0, 0))).toEqual(rgb(0, 0, 0));
  });
});

describe('toHsl', () => {
  it('converts the corners of the wheel', () => {
    expect(toHsl(rgb(255, 0, 0))).toEqual({ hue: 0, saturation: 100, lightness: 50 });
    expect(toHsl(rgb(0, 255, 0))).toEqual({ hue: 120, saturation: 100, lightness: 50 });
    expect(toHsl(rgb(0, 0, 255))).toEqual({ hue: 240, saturation: 100, lightness: 50 });
    expect(toHsl(rgb(0, 255, 255))).toEqual({ hue: 180, saturation: 100, lightness: 50 });
  });

  it('gives a grey no hue rather than whatever the arithmetic left', () => {
    // Every hue produces a grey, so reporting one would be inventing it.
    expect(toHsl(rgb(128, 128, 128))).toEqual({ hue: 0, saturation: 0, lightness: 50 });
    expect(toHsl(rgb(255, 255, 255))).toEqual({ hue: 0, saturation: 0, lightness: 100 });
    expect(toHsl(rgb(0, 0, 0))).toEqual({ hue: 0, saturation: 0, lightness: 0 });
  });

  it('keeps the hue positive when red leads', () => {
    // Magenta sits below red on the wheel, which is where a modulo goes wrong.
    expect(toHsl(rgb(255, 0, 128)).hue).toBe(330);
    expect(toHsl(rgb(255, 128, 0)).hue).toBe(30);
  });
});

describe('fromHex', () => {
  it('reads both lengths, with or without the hash', () => {
    expect(fromHex('#f6a500')).toEqual(rgb(246, 165, 0));
    expect(fromHex('f6a500')).toEqual(rgb(246, 165, 0));
    expect(fromHex('#FFF')).toEqual(rgb(255, 255, 255));
    expect(fromHex('  #010203  ')).toEqual(rgb(1, 2, 3));
  });

  it('reads nothing out of something that is not a colour', () => {
    expect(fromHex('#ff')).toBeUndefined();
    expect(fromHex('rgb(1,2,3)')).toBeUndefined();
    expect(fromHex('')).toBeUndefined();
  });

  it('round-trips every value it writes', () => {
    for (const colour of [rgb(0, 0, 0), rgb(255, 255, 255), rgb(246, 165, 0), rgb(15, 23, 42)]) {
      expect(fromHex(toHex(colour))).toEqual(colour);
    }
  });
});

describe('prefersDarkText', () => {
  it('reads the swatch the way an eye does, not the way lightness does', () => {
    // Yellow is the case a lightness threshold gets wrong: it is bright.
    expect(prefersDarkText(rgb(255, 255, 0))).toBe(true);
    expect(prefersDarkText(rgb(255, 255, 255))).toBe(true);
    expect(prefersDarkText(rgb(0, 0, 255))).toBe(false);
    expect(prefersDarkText(rgb(15, 23, 42))).toBe(false);
  });
});

describe('describePickedColour', () => {
  const picked = describePickedColour(rgb(246, 165, 0), { x: 10.6, y: 4.2 });

  it('carries every value the page shows, and where it came from', () => {
    expect(picked.hex).toBe('#f6a500');
    expect(picked.rgb).toBe('rgb(246, 165, 0)');
    expect(picked.hsl).toBe('hsl(40, 100%, 48%)');
    expect(picked).toMatchObject({ x: 11, y: 4, red: 246, green: 165, blue: 0 });
  });

  it('offers the three values in the order the page copies them', () => {
    expect(getColourValues(picked)).toEqual([
      { label: 'HEX', value: '#f6a500' },
      { label: 'RGB', value: 'rgb(246, 165, 0)' },
      { label: 'HSL', value: 'hsl(40, 100%, 48%)' },
    ]);
  });
});

describe('the colours it remembers', () => {
  const pick = (hex: string) => describePickedColour(fromHex(hex)!, { x: 0, y: 0 });

  it('keeps the newest first', () => {
    const history = addToColourHistory(addToColourHistory([], pick('#111111')), pick('#222222'));

    expect(history.map((entry) => entry.hex)).toEqual(['#222222', '#111111']);
  });

  it('moves a repeat rather than duplicating it', () => {
    // Picking the same colour twice is how somebody checks they picked it.
    const history = [pick('#111111'), pick('#222222')].reduce(
      (all, colour) => addToColourHistory(all, colour),
      [] as readonly ReturnType<typeof pick>[],
    );

    expect(addToColourHistory(history, pick('#111111')).map((entry) => entry.hex)).toEqual([
      '#111111',
      '#222222',
    ]);
  });

  it('remembers only so many', () => {
    const history = Array.from({ length: colourHistoryLimit + 4 }, (_value, index) =>
      pick(`#0000${index.toString(16).padStart(2, '0')}`),
    ).reduce((all, colour) => addToColourHistory(all, colour), [] as readonly ReturnType<typeof pick>[]);

    expect(history).toHaveLength(colourHistoryLimit);
    expect(history[0].hex).toBe('#00000b');
  });
});

describe('clampToImage', () => {
  it('keeps a pick on the picture', () => {
    expect(clampToImage({ x: -5, y: 400 }, { width: 40, height: 20 })).toEqual({ x: 0, y: 19 });
    expect(clampToImage({ x: 39.6, y: 0 }, { width: 40, height: 20 })).toEqual({ x: 39, y: 0 });
  });

  it('survives an image with no pixels', () => {
    expect(clampToImage({ x: 5, y: 5 }, { width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
  });
});
