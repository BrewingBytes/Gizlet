import {
  describeLocalZone,
  formatIsoInstant,
  formatLocalInstant,
  formatUtcInstant,
  formatUtcOffset,
  formatWeekday,
  getLocalOffsetMinutes,
  isInstant,
  maximumInstantMilliseconds,
} from './instant';

/**
 * A number read as a moment, and a moment read back as a number.
 *
 * The one rule this page will not break is guessing the unit. A count of
 * seconds and a count of milliseconds look identical — both are a run of
 * digits — and every converter that decides for you is wrong for somebody: the
 * same ten digits are a moment in 2026 read as seconds and a moment four
 * months into 1970 read as milliseconds, and there is nothing in the number
 * itself that settles it. So the unit is a control the visitor sets, and when
 * the magnitude disagrees with it this says so and offers the other reading
 * rather than quietly switching.
 *
 * The other direction has the same problem wearing a different hat. `2026-09-07
 * 14:30` is not a moment until somebody says which clock it was read off, so
 * that is a control too — and an offset written into the text itself outranks
 * it, because a person who typed `+02:00` has already answered.
 *
 * Nothing is parsed with `new Date(string)`. What that accepts is up to the
 * browser: `2026-09-07` is UTC, `2026-9-7` is local in some engines and
 * rejected in others, and a two-digit year is anybody's guess. The shapes
 * accepted here are written down, so the answer does not change with the
 * browser.
 */

export const timestampUnits = ['seconds', 'milliseconds'] as const;

export type TimestampUnit = (typeof timestampUnits)[number];

export interface TimestampUnitDetail {
  readonly id: TimestampUnit;
  readonly label: string;
  /** How many of this unit make a second, which is the whole difference. */
  readonly perSecond: number;
  readonly note: string;
}

export const timestampUnitDetails: readonly TimestampUnitDetail[] = [
  {
    id: 'seconds',
    label: 'Seconds',
    perSecond: 1,
    note: 'Unix time proper, and what almost everything that says “timestamp” means: 10 digits for a moment in this century. What date +%s prints, what a JWT’s exp counts, what an integer column usually holds.',
  },
  {
    id: 'milliseconds',
    label: 'Milliseconds',
    perSecond: 1000,
    note: 'What JavaScript and the JVM count in: 13 digits for a moment in this century. What Date.now() and System.currentTimeMillis() return, and most things that came out of a browser.',
  },
];

export const defaultTimestampUnit: TimestampUnit = 'seconds';

export function isTimestampUnit(value: string): value is TimestampUnit {
  return timestampUnits.includes(value as TimestampUnit);
}

export function getTimestampUnit(id: TimestampUnit): TimestampUnitDetail {
  const detail = timestampUnitDetails.find((candidate) => candidate.id === id);

  if (!detail) throw new Error(`Missing timestamp unit: ${id}`);

  return detail;
}

/** The clock a typed-in date was read off, when the text does not say. */
export const dateTimeZones = ['utc', 'local'] as const;

export type DateTimeZone = (typeof dateTimeZones)[number];

export const defaultDateTimeZone: DateTimeZone = 'utc';

export function isDateTimeZone(value: string): value is DateTimeZone {
  return dateTimeZones.includes(value as DateTimeZone);
}

/**
 * Where the two readings of a number swap plausibility.
 *
 * Above this, seconds put you past the year 5138 and milliseconds put you in
 * this century; below it, the reverse. It is the boundary rather than a
 * decision: the note says which side the number falls on and leaves the
 * control alone.
 */
export const unitBoundary = 100_000_000_000;

/** Every way a moment can be written out once it is known. */
export interface Instant {
  readonly milliseconds: number;
  /** Whole seconds, floored onto the timeline so a negative one still counts down. */
  readonly seconds: number;
  readonly iso: string;
  readonly utc: string;
  readonly local: string;
  /** `UTC+03:00`, this device's own offset at that moment rather than today's. */
  readonly localZone: string;
  readonly weekdayUtc: string;
  readonly weekdayLocal: string;
}

/**
 * A moment written every way at once.
 *
 * The offset is taken at the moment in question, not at the moment of asking:
 * a summer timestamp read in winter belongs to the summer offset, and a page
 * that prints today's would be wrong for half the year.
 */
export function describeInstant(milliseconds: number): Instant | undefined {
  const moment = new Date(milliseconds);

  if (!isInstant(moment)) return undefined;

  const iso = formatIsoInstant(moment);
  const utc = formatUtcInstant(moment);
  const local = formatLocalInstant(moment);
  const weekdayUtc = formatWeekday(moment, 'utc');
  const weekdayLocal = formatWeekday(moment, 'local');

  if (!iso || !utc || !local || !weekdayUtc || !weekdayLocal) return undefined;

  return {
    milliseconds,
    seconds: Math.floor(milliseconds / 1000),
    iso,
    utc,
    local,
    localZone: describeLocalZone(moment),
    weekdayUtc,
    weekdayLocal,
  };
}

export interface TimestampReading {
  readonly instant: Instant;
  /** The unit the visitor chose, which is the one that was used. */
  readonly unit: TimestampUnit;
  /** What was read past, and what the other unit would have said. */
  readonly notes: readonly string[];
}

export type TimestampResult =
  | { readonly ok: true; readonly reading: TimestampReading }
  | { readonly ok: false; readonly message: string };

const numeric = /^[+-]?\d+(?:\.\d+)?$/;

/** Digits with the separators a person pastes: `1_749_900_000`, `1,749,900,000`. */
const separators = /[\s_,']/g;

function describeYear(milliseconds: number): string {
  const moment = new Date(milliseconds);

  return isInstant(moment) ? `the year ${moment.getUTCFullYear()}` : 'no year at all';
}

/**
 * The other unit's reading, so the note can offer it rather than assert it.
 *
 * This is the whole of the "explicitly, not guessed" rule in one function: the
 * disagreement is described, both readings are named, and the control the
 * visitor set is the one that was actually used.
 */
function describeUnitMismatch(value: number, unit: TimestampUnit): string | undefined {
  const magnitude = Math.abs(value);

  if (magnitude === 0) return undefined;

  if (unit === 'seconds' && magnitude >= unitBoundary) {
    return `As seconds that is ${describeYear(value * 1000)}. A number this large is usually milliseconds — ${describeYear(value)} — which is what Date.now() gives. Nothing was changed for you: switch the unit if that is what you meant.`;
  }

  if (unit === 'milliseconds' && magnitude < unitBoundary) {
    return `As milliseconds that is ${describeYear(value)}. A number this small is usually seconds — ${describeYear(value * 1000)} — which is what Unix time counts in. Nothing was changed for you: switch the unit if that is what you meant.`;
  }

  return undefined;
}

/**
 * A number read as a moment in the unit that was chosen for it.
 *
 * An empty field is not a failure — it is a question not yet asked — so it
 * comes back as `undefined` rather than as an error the page would have to
 * show somebody who has typed nothing.
 */
export function readTimestamp(input: string, unit: TimestampUnit): TimestampResult | undefined {
  const trimmed = input.trim();

  if (trimmed === '') return undefined;

  const cleaned = trimmed.replace(separators, '');
  const notes: string[] = [];

  if (!numeric.test(cleaned)) {
    return {
      ok: false,
      message:
        'That is not a count of anything. A timestamp is digits — optionally negative for a moment before 1970, optionally with a decimal fraction — and a date belongs in the other box.',
    };
  }

  if (cleaned !== trimmed) {
    notes.push('Spaces, underscores and commas in the number were read past.');
  }

  const value = Number(cleaned);

  if (!Number.isFinite(value)) {
    return { ok: false, message: 'That number is too long for this to read at all.' };
  }

  const milliseconds = unit === 'seconds' ? value * 1000 : value;

  if (Math.abs(milliseconds) > maximumInstantMilliseconds) {
    const detail = getTimestampUnit(unit);

    return {
      ok: false,
      message: `That is outside every calendar this can write. Counted in ${detail.label.toLowerCase()} it lands beyond the year 275760, which is as far as a date reaches here.`,
    };
  }

  const instant = describeInstant(milliseconds);

  if (!instant) {
    return { ok: false, message: 'That number does not land on a moment this can write down.' };
  }

  const mismatch = describeUnitMismatch(value, unit);

  if (mismatch) notes.push(mismatch);

  if (!Number.isInteger(milliseconds)) {
    notes.push('The fraction below a millisecond was kept in the number and dropped from the date, which is as fine as a date gets here.');
  }

  return { ok: true, reading: { instant, unit, notes } };
}

/** How the wall clock in the text was turned into a moment. */
export type DateTimeSource = 'utc' | 'local' | 'offset';

export interface DateTimeReading {
  readonly instant: Instant;
  readonly source: DateTimeSource;
  /** The offset actually used, whether it was typed or came from the device. */
  readonly offset: string;
  readonly notes: readonly string[];
}

export type DateTimeResult =
  | { readonly ok: true; readonly reading: DateTimeReading }
  | { readonly ok: false; readonly message: string };

/**
 * The date shapes this accepts, written down rather than left to the browser.
 *
 * A date on its own, or a date and a time separated by `T` or a space, with
 * optional seconds and an optional fraction, and an optional `Z` or `±HH:MM`
 * on the end.
 */
const dateTime =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;

const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getMonthLength(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : monthLengths[month - 1];
}

/** `+02:00` or `Z` as minutes east of UTC. */
function readOffsetMinutes(text: string): number {
  if (text.toUpperCase() === 'Z') return 0;

  const sign = text.startsWith('-') ? -1 : 1;
  const digits = text.slice(1).replace(':', '');

  return sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2)));
}

/**
 * A written date read back into a moment.
 *
 * The zone is only consulted when the text is silent about it. An offset in
 * the text wins, because somebody who wrote `+02:00` has already said which
 * clock they meant and a control cannot know better than that.
 */
export function readDateTime(input: string, zone: DateTimeZone): DateTimeResult | undefined {
  const trimmed = input.trim();

  if (trimmed === '') return undefined;

  const parts = dateTime.exec(trimmed);

  if (!parts) {
    return {
      ok: false,
      message:
        'That is not a date this reads. Write it as 2026-09-07, or 2026-09-07 14:30, or 2026-09-07T14:30:00 — with a Z or a +02:00 on the end if you know the offset.',
    };
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fractionText, offsetText] = parts;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText ?? '0');
  const minute = Number(minuteText ?? '0');
  const second = Number(secondText ?? '0');
  const fraction = fractionText ? Number(`0.${fractionText}`) : 0;
  const notes: string[] = [];

  if (month < 1 || month > 12) {
    return { ok: false, message: `There is no month ${month}. A year has twelve.` };
  }

  const length = getMonthLength(year, month);

  if (day < 1 || day > length) {
    return {
      ok: false,
      message: `${monthNames[month - 1]} ${year} has ${length} days, so there is no ${day}${day > length ? 'th' : ''}.`,
    };
  }

  if (hour > 23) {
    return { ok: false, message: `There is no hour ${hour}. A day runs 00 to 23.` };
  }

  if (minute > 59 || second > 59) {
    // A leap second is a real thing the calendar refuses to hold, and saying
    // so is more use than reporting the minute as merely invalid.
    return {
      ok: false,
      message:
        second === 60
          ? 'A leap second is real and no calendar here can hold one: the second runs 00 to 59.'
          : 'Minutes and seconds run 00 to 59.',
    };
  }

  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second, Math.round(fraction * 1000));
  const source: DateTimeSource = offsetText ? 'offset' : zone;
  const offsetMinutes = offsetText
    ? readOffsetMinutes(offsetText)
    : zone === 'utc'
      ? 0
      : getLocalOffsetMinutes(new Date(wallClock));
  const milliseconds = wallClock - offsetMinutes * 60_000;

  if (Math.abs(milliseconds) > maximumInstantMilliseconds) {
    return {
      ok: false,
      message: 'That date is beyond the year 275760, which is as far as a date reaches here.',
    };
  }

  const instant = describeInstant(milliseconds);

  if (!instant) {
    return { ok: false, message: 'That date does not land on a moment this can write down.' };
  }

  if (offsetText) {
    notes.push(
      `The offset in the text, ${formatUtcOffset(offsetMinutes)}, was used rather than the setting above — it says which clock you meant.`,
    );
  } else if (hourText === undefined) {
    notes.push(`No time was given, so it was read as midnight ${zone === 'utc' ? 'UTC' : 'on this device'}.`);
  }

  return { ok: true, reading: { instant, source, offset: formatUtcOffset(offsetMinutes), notes } };
}

/** The current moment as the field would hold it, so the clock stays outside. */
export function formatTimestampInput(now: number, unit: TimestampUnit): string {
  return String(unit === 'seconds' ? Math.floor(now / 1000) : now);
}

/** The current moment as the date field would hold it, to the second. */
export function formatDateTimeInput(now: number, zone: DateTimeZone): string {
  const instant = describeInstant(now);

  if (!instant) return '';

  return zone === 'utc' ? instant.utc.replace(' UTC', '') : instant.local;
}
