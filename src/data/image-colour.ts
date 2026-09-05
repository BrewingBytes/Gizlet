/**
 * One pixel, said three ways.
 *
 * The conversions are here rather than in the component for the usual reason —
 * they are arithmetic, and arithmetic is what a test can hold to account —
 * but also because HSL is where colour code quietly goes wrong: the hue of a
 * grey is undefined, the rounding decides whether a value reads as 50% or 49%,
 * and neither shows up until somebody pastes the result into a stylesheet.
 */

export interface RgbColour {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

export interface HslColour {
  readonly hue: number;
  readonly saturation: number;
  readonly lightness: number;
}

/** A picked pixel, with everything a visitor might copy out of it. */
export interface PickedColour extends RgbColour {
  readonly hex: string;
  readonly rgb: string;
  readonly hsl: string;
  /** Where it was picked, in the image's own pixels. */
  readonly x: number;
  readonly y: number;
}

function clampChannel(value: number): number {
  if (!Number.isFinite(value)) return 0;

  return Math.min(255, Math.max(0, Math.round(value)));
}

export function clampRgb(colour: RgbColour): RgbColour {
  return {
    red: clampChannel(colour.red),
    green: clampChannel(colour.green),
    blue: clampChannel(colour.blue),
  };
}

/** `#rrggbb`, lower case, which is what a stylesheet and a colour input take. */
export function toHex(colour: RgbColour): string {
  const { red, green, blue } = clampRgb(colour);

  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function toRgbString(colour: RgbColour): string {
  const { red, green, blue } = clampRgb(colour);

  return `rgb(${red}, ${green}, ${blue})`;
}

/**
 * The same colour in hue, saturation and lightness.
 *
 * A grey has no hue — every hue produces it — so it is reported as 0 rather
 * than as whatever the arithmetic happened to leave behind, which is the
 * convention every browser also prints.
 */
export function toHsl(colour: RgbColour): HslColour {
  const { red, green, blue } = clampRgb(colour);
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { hue: 0, saturation: 0, lightness: Math.round(lightness * 100) };
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const hue =
    max === r
      ? ((g - b) / delta) % 6
      : max === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4;

  return {
    hue: Math.round(((hue * 60) + 360) % 360),
    saturation: Math.round(saturation * 100),
    lightness: Math.round(lightness * 100),
  };
}

export function toHslString(colour: RgbColour): string {
  const { hue, saturation, lightness } = toHsl(colour);

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/** Reads a `#rgb` or `#rrggbb` back, for a value arriving from a control. */
export function fromHex(value: string): RgbColour | undefined {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());

  if (!match) return undefined;

  const digits =
    match[1].length === 3
      ? match[1].split('').map((digit) => digit + digit).join('')
      : match[1];

  return {
    red: Number.parseInt(digits.slice(0, 2), 16),
    green: Number.parseInt(digits.slice(2, 4), 16),
    blue: Number.parseInt(digits.slice(4, 6), 16),
  };
}

/**
 * Whether text on this colour should be dark.
 *
 * The swatch prints its own hex over itself, so the label has to stay readable
 * on both a pale yellow and a navy. This is the WCAG relative-luminance formula
 * rather than a lightness threshold, because lightness gets yellow wrong.
 */
export function prefersDarkText(colour: RgbColour): boolean {
  const channels = [colour.red, colour.green, colour.blue].map((value) => {
    const channel = clampChannel(value) / 255;

    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];

  return luminance > 0.179;
}

/** Everything about one picked pixel, in the order the page shows it. */
export function describePickedColour(colour: RgbColour, at: { readonly x: number; readonly y: number }): PickedColour {
  const clamped = clampRgb(colour);

  return {
    ...clamped,
    hex: toHex(clamped),
    rgb: toRgbString(clamped),
    hsl: toHslString(clamped),
    x: Math.max(0, Math.round(at.x)),
    y: Math.max(0, Math.round(at.y)),
  };
}

/** How many colours the picker remembers, for this visit only. */
export const colourHistoryLimit = 8;

/**
 * The recent colours, newest first, with a repeat moved rather than duplicated.
 *
 * Picking the same colour twice is how somebody checks they picked it, so a
 * history that filled with one colour would be a history of one mistake.
 */
export function addToColourHistory(
  history: readonly PickedColour[],
  colour: PickedColour,
): readonly PickedColour[] {
  return [colour, ...history.filter((entry) => entry.hex !== colour.hex)].slice(
    0,
    colourHistoryLimit,
  );
}

/** Keeps a pick inside the picture, whatever the pointer or the arrow key did. */
export function clampToImage(
  point: { readonly x: number; readonly y: number },
  image: { readonly width: number; readonly height: number },
): { readonly x: number; readonly y: number } {
  return {
    x: Math.min(Math.max(0, Math.round(point.x)), Math.max(0, image.width - 1)),
    y: Math.min(Math.max(0, Math.round(point.y)), Math.max(0, image.height - 1)),
  };
}

/** The three values a visitor can copy, in the order they are offered. */
export function getColourValues(
  colour: PickedColour,
): readonly { readonly label: string; readonly value: string }[] {
  return [
    { label: 'HEX', value: colour.hex },
    { label: 'RGB', value: colour.rgb },
    { label: 'HSL', value: colour.hsl },
  ];
}
