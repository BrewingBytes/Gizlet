import { describe, expect, it } from 'vitest';

import {
  collageLayoutNames,
  collageLayouts,
  defaultCollageLayout,
  describeCollage,
  describeCollageImageCount,
  getCollageColumns,
  getCollageLayoutOptions,
  getCollageOutputFilename,
  getCollageSourceRectangle,
  isCollageBackground,
  isCollageLayoutName,
  maximumCollageImages,
  maximumCollageSpacing,
  minimumCollageWidth,
  planCollage,
  validateCollage,
  validateCollageSpacing,
  validateCollageWidth,
  type CollageItem,
  type CollagePlan,
} from '../../src/data/image-collage';
import { maximumImageDimension, maximumImagePixels } from '../../src/data/image-resize';

const squares = (count: number): readonly CollageItem[] =>
  Array.from({ length: count }, () => ({ width: 100, height: 100 }));

const options = { layout: 'grid', spacing: 16, width: 1600 } as const;

/** Every cell inside the collage, with nothing overlapping anything else. */
function overlaps(plan: CollagePlan): boolean {
  return plan.cells.some((cell, index) =>
    plan.cells.slice(index + 1).some(
      (other) =>
        cell.x < other.x + other.width &&
        other.x < cell.x + cell.width &&
        cell.y < other.y + other.height &&
        other.y < cell.y + cell.height,
    ),
  );
}

describe('the layouts on offer', () => {
  it('names every layout it can plan, and says what each one does', () => {
    for (const name of collageLayoutNames) {
      expect(isCollageLayoutName(name), name).toBe(true);
      expect(collageLayouts[name].description.length, name).toBeGreaterThan(0);
    }

    expect(isCollageLayoutName('mosaic')).toBe(false);
    expect(isCollageLayoutName(defaultCollageLayout)).toBe(true);
  });

  it('hands a control its labels rather than letting markup retype them', () => {
    expect(getCollageLayoutOptions().map((option) => option.value)).toEqual([...collageLayoutNames]);
    expect(getCollageLayoutOptions()[0].label).toBe(collageLayouts[collageLayoutNames[0]].label);
  });

  it('counts images the way a sentence does', () => {
    expect(describeCollageImageCount(1)).toBe('1 image');
    expect(describeCollageImageCount(7)).toBe('7 images');
  });
});

describe('getCollageColumns', () => {
  it('makes a grid as square as the count allows', () => {
    expect(getCollageColumns(1, 'grid')).toBe(1);
    expect(getCollageColumns(4, 'grid')).toBe(2);
    // Five images are a 3x2 with a gap rather than a strip of five.
    expect(getCollageColumns(5, 'grid')).toBe(3);
    expect(getCollageColumns(9, 'grid')).toBe(3);
  });

  it('lets a row and a column say so', () => {
    expect(getCollageColumns(5, 'row')).toBe(5);
    expect(getCollageColumns(5, 'column')).toBe(1);
    expect(getCollageColumns(0, 'grid')).toBe(0);
  });
});

describe('planCollage', () => {
  it('lays a grid out in rows, at the width it was given', () => {
    const plan = planCollage(squares(4), options);

    expect(plan.width).toBe(1600);
    expect(plan.height).toBe(1600);
    expect(plan.cells).toEqual([
      { index: 0, x: 16, y: 16, width: 776, height: 776 },
      { index: 1, x: 808, y: 16, width: 776, height: 776 },
      { index: 2, x: 16, y: 808, width: 776, height: 776 },
      { index: 3, x: 808, y: 808, width: 776, height: 776 },
    ]);
  });

  it('shapes cells like the pictures going into them, on average', () => {
    // Three landscape pictures make three landscape cells rather than squares.
    const plan = planCollage(
      [
        { width: 100, height: 50 },
        { width: 100, height: 50 },
        { width: 100, height: 50 },
      ],
      { layout: 'row', spacing: 10, width: 1000 },
    );

    expect(plan.cells.map((cell) => cell.width)).toEqual([320, 320, 320]);
    expect(plan.cells.map((cell) => cell.height)).toEqual([160, 160, 160]);
    expect(plan.cells.map((cell) => cell.y)).toEqual([10, 10, 10]);
    expect(plan.height).toBe(180);
  });

  it('stacks a column', () => {
    const plan = planCollage(squares(3), { layout: 'column', spacing: 10, width: 500 });

    expect(plan.cells.map((cell) => cell.x)).toEqual([10, 10, 10]);
    expect(plan.cells.map((cell) => cell.y)).toEqual([10, 500, 990]);
    expect(plan.height).toBe(1480);
  });

  it('gives the first picture the feature position and stacks the rest beside it', () => {
    const plan = planCollage(
      [
        { width: 200, height: 100 },
        { width: 100, height: 100 },
        { width: 100, height: 100 },
      ],
      { layout: 'feature', spacing: 20, width: 1000 },
    );

    expect(plan.cells[0]).toEqual({ index: 0, x: 20, y: 20, width: 627, height: 314 });
    expect(plan.cells[1]).toEqual({ index: 1, x: 667, y: 20, width: 313, height: 147 });
    expect(plan.cells[2]).toEqual({ index: 2, x: 667, y: 187, width: 313, height: 147 });
    expect(plan.height).toBe(354);
  });

  it('treats a single image as a single cell, whatever the layout says', () => {
    for (const layout of collageLayoutNames) {
      const plan = planCollage(squares(1), { layout, spacing: 16, width: 1600 });

      expect(plan.cells, layout).toHaveLength(1);
      expect(plan.cells[0].index, layout).toBe(0);
      expect(plan.height, layout).toBe(1600);
    }
  });

  it('keeps every cell inside the collage and off every other cell', () => {
    for (const layout of collageLayoutNames) {
      for (const count of [1, 2, 5, maximumCollageImages]) {
        const plan = planCollage(squares(count), { layout, spacing: 12, width: 1200 });

        expect(plan.cells, `${layout} ${count}`).toHaveLength(count);
        expect(overlaps(plan), `${layout} ${count}`).toBe(false);

        for (const cell of plan.cells) {
          expect(cell.x, `${layout} ${count}`).toBeGreaterThanOrEqual(0);
          expect(cell.y, `${layout} ${count}`).toBeGreaterThanOrEqual(0);
          expect(cell.x + cell.width, `${layout} ${count}`).toBeLessThanOrEqual(plan.width);
          expect(cell.y + cell.height, `${layout} ${count}`).toBeLessThanOrEqual(plan.height);
        }
      }
    }
  });

  it('draws the pictures in the order they were handed over', () => {
    const plan = planCollage(squares(6), options);

    expect(plan.cells.map((cell) => cell.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('lets a gap of zero make the pictures touch', () => {
    const plan = planCollage(squares(2), { layout: 'row', spacing: 0, width: 1000 });

    expect(plan.cells[0]).toEqual({ index: 0, x: 0, y: 0, width: 500, height: 500 });
    expect(plan.cells[1]).toEqual({ index: 1, x: 500, y: 0, width: 500, height: 500 });
    expect(plan.height).toBe(500);
  });

  it('plans nothing for nothing, rather than a collage of no images', () => {
    expect(planCollage([], options).cells).toEqual([]);
  });

  it('survives an image with no usable dimensions', () => {
    const plan = planCollage([{ width: 0, height: 0 }], options);

    expect(plan.cells).toHaveLength(1);
    expect(plan.height).toBeGreaterThan(0);
  });
});

describe('validateCollage', () => {
  it('accepts an ordinary collage', () => {
    expect(validateCollage(squares(4), planCollage(squares(4), options))).toBeUndefined();
  });

  it('asks for at least one image, and no more than the ceiling', () => {
    expect(validateCollage([], planCollage([], options))).toMatch(/at least one image/);
    expect(
      validateCollage(
        squares(maximumCollageImages + 1),
        planCollage(squares(maximumCollageImages + 1), options),
      ),
    ).toMatch(new RegExp(`${maximumCollageImages} images`));
  });

  it('measures the pixel limits against the whole collage, not one picture', () => {
    // Every picture here is well inside the limits; what they add up to is not.
    const wide = { layout: 'row', spacing: 0, width: 8000 } as const;
    const tall = { layout: 'column', spacing: 0, width: 12_000 } as const;

    expect(validateCollage(squares(2), planCollage(squares(2), wide))).toBeUndefined();
    expect(
      validateCollage(
        squares(1),
        planCollage(squares(1), { layout: 'grid', spacing: 0, width: maximumImageDimension }),
      ),
    ).toMatch(new RegExp(maximumImagePixels.toLocaleString()));
    expect(validateCollage(squares(4), planCollage(squares(4), tall))).toMatch(
      new RegExp(maximumImageDimension.toLocaleString()),
    );
  });
});

describe('the settings a visitor types', () => {
  it('takes a whole width inside the limits', () => {
    expect(validateCollageWidth(1600)).toBeUndefined();
    expect(validateCollageWidth(minimumCollageWidth)).toBeUndefined();
    expect(validateCollageWidth(minimumCollageWidth - 1)).toMatch(/at least/);
    expect(validateCollageWidth(1600.5)).toMatch(/whole width/);
    expect(validateCollageWidth(Number.NaN)).toMatch(/whole width/);
    expect(validateCollageWidth(maximumImageDimension + 1)).toMatch(/or less/);
  });

  it('takes a whole gap, including none at all', () => {
    expect(validateCollageSpacing(0)).toBeUndefined();
    expect(validateCollageSpacing(maximumCollageSpacing)).toBeUndefined();
    expect(validateCollageSpacing(-1)).toMatch(/zero pixels or more/);
    expect(validateCollageSpacing(4.5)).toMatch(/zero pixels or more/);
    expect(validateCollageSpacing(maximumCollageSpacing + 1)).toMatch(/or less/);
  });

  it('takes a colour a canvas will accept, and nothing else', () => {
    expect(isCollageBackground('#ffffff')).toBe(true);
    expect(isCollageBackground('#0F172A')).toBe(true);
    expect(isCollageBackground('white')).toBe(false);
    expect(isCollageBackground('#fff')).toBe(false);
    expect(isCollageBackground('')).toBe(false);
  });
});

describe('getCollageSourceRectangle', () => {
  it('fills a cell rather than fitting one, trimming evenly', () => {
    expect(getCollageSourceRectangle({ width: 200, height: 100 }, { width: 100, height: 100 })).toEqual({
      x: 50,
      y: 0,
      width: 100,
      height: 100,
    });
    expect(getCollageSourceRectangle({ width: 100, height: 200 }, { width: 100, height: 100 })).toEqual({
      x: 0,
      y: 50,
      width: 100,
      height: 100,
    });
  });

  it('takes the whole picture when it is already the cell’s shape', () => {
    expect(getCollageSourceRectangle({ width: 400, height: 200 }, { width: 200, height: 100 })).toEqual({
      x: 0,
      y: 0,
      width: 400,
      height: 200,
    });
  });

  it('hands back something drawable for a picture with no dimensions', () => {
    expect(getCollageSourceRectangle({ width: 0, height: 0 }, { width: 100, height: 100 })).toEqual({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
  });
});

describe('what a collage is called', () => {
  it('says its size and its arrangement', () => {
    expect(describeCollage(planCollage(squares(4), options), 'grid')).toBe('1600 × 1600 px · grid');
  });

  it('names the file for what it is, in the chosen format', () => {
    expect(getCollageOutputFilename('holiday.jpg', 'image/webp')).toBe('holiday-collage.webp');
    expect(getCollageOutputFilename('a.b.png', 'image/jpeg')).toBe('a.b-collage.jpg');
    expect(getCollageOutputFilename('', 'image/png')).toBe('images-collage.png');
  });
});
