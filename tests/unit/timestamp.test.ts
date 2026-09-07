import { describe, expect, it } from 'vitest';

import { getLocalOffsetMinutes } from '../../src/data/instant';
import {
  defaultDateTimeZone,
  defaultTimestampUnit,
  describeInstant,
  formatDateTimeInput,
  formatTimestampInput,
  getMonthLength,
  getTimestampUnit,
  isDateTimeZone,
  isTimestampUnit,
  readDateTime,
  readTimestamp,
  timestampUnitDetails,
  timestampUnits,
  unitBoundary,
  type DateTimeZone,
  type TimestampUnit,
} from '../../src/data/timestamp';

/** 2026-09-07 09:15:00 UTC, the moment the rest of these are written against. */
const now = Date.UTC(2026, 8, 7, 9, 15, 0);

const readingOf = (input: string, unit: TimestampUnit = 'seconds') => {
  const result = readTimestamp(input, unit);

  if (result?.ok !== true) throw new Error(`Expected a reading: ${input}`);

  return result.reading;
};

const refusalOf = (input: string, unit: TimestampUnit = 'seconds') => {
  const result = readTimestamp(input, unit);

  if (result?.ok !== false) throw new Error(`Expected a refusal: ${input}`);

  return result.message;
};

const dateOf = (input: string, zone: DateTimeZone = 'utc') => {
  const result = readDateTime(input, zone);

  if (result?.ok !== true) throw new Error(`Expected a date: ${input}`);

  return result.reading;
};

const dateRefusalOf = (input: string, zone: DateTimeZone = 'utc') => {
  const result = readDateTime(input, zone);

  if (result?.ok !== false) throw new Error(`Expected a refusal: ${input}`);

  return result.message;
};

describe('the units', () => {
  it('offers the two counts anything means by “timestamp”, and defaults to Unix time', () => {
    expect(timestampUnits).toEqual(['seconds', 'milliseconds']);
    expect(timestampUnitDetails.map((detail) => detail.id)).toEqual([...timestampUnits]);
    expect(timestampUnitDetails.map((detail) => detail.perSecond)).toEqual([1, 1000]);
    expect(defaultTimestampUnit).toBe('seconds');
    expect(defaultDateTimeZone).toBe('utc');
  });

  it('recognises its own names and nothing else', () => {
    expect(isTimestampUnit('seconds')).toBe(true);
    expect(isTimestampUnit('nanoseconds')).toBe(false);
    expect(isDateTimeZone('local')).toBe(true);
    expect(isDateTimeZone('Europe/Bucharest')).toBe(false);
    expect(() => getTimestampUnit('nanoseconds' as TimestampUnit)).toThrow('Missing timestamp unit');
  });
});

describe('reading a timestamp', () => {
  it('treats an empty field as a question not yet asked', () => {
    expect(readTimestamp('', 'seconds')).toBeUndefined();
    expect(readTimestamp('   ', 'milliseconds')).toBeUndefined();
  });

  it('reads the epoch itself', () => {
    const { instant } = readingOf('0');

    expect(instant.milliseconds).toBe(0);
    expect(instant.seconds).toBe(0);
    expect(instant.iso).toBe('1970-01-01T00:00:00Z');
    expect(instant.utc).toBe('1970-01-01 00:00:00 UTC');
    expect(instant.weekdayUtc).toBe('Thursday');
  });

  it('reads the same digits differently in each unit, and says so neither time', () => {
    expect(readingOf('1749900000', 'seconds').instant.utc).toBe('2025-06-14 11:20:00 UTC');
    expect(readingOf('1749900000000', 'milliseconds').instant.utc).toBe('2025-06-14 11:20:00 UTC');
  });

  it('counts backwards for a moment before 1970', () => {
    const { instant } = readingOf('-14182940');

    expect(instant.utc).toBe('1969-07-20 20:17:40 UTC');
    expect(instant.seconds).toBe(-14_182_940);
  });

  it('floors a negative fraction onto the timeline rather than towards zero', () => {
    // -1500 ms is half a second before the epoch, which is second -2 of the
    // timeline and not second -1: truncating would put it in the future.
    expect(readingOf('-1500', 'milliseconds').instant.seconds).toBe(-2);
  });

  it('reads past the separators a person pastes, and says it did', () => {
    const reading = readingOf('1_749_900_000');

    expect(reading.instant.utc).toBe('2025-06-14 11:20:00 UTC');
    expect(reading.notes).toContain('Spaces, underscores and commas in the number were read past.');
    expect(readingOf('1,749,900,000').instant.milliseconds).toBe(1_749_900_000_000);
  });

  it('keeps a fractional second and says what it did with it', () => {
    const reading = readingOf('1749900000.25');

    expect(reading.instant.milliseconds).toBe(1_749_900_000_250);
    expect(reading.instant.iso).toBe('2025-06-14T11:20:00.250Z');
  });

  it('offers the other unit when the magnitude disagrees, and changes nothing', () => {
    const asSeconds = readingOf('1749900000000', 'seconds');

    expect(asSeconds.unit).toBe('seconds');
    // The reading is the one that was asked for, wrong-looking or not.
    expect(asSeconds.instant.utc).toContain('57422-');
    expect(asSeconds.notes[0]).toContain('usually milliseconds');
    expect(asSeconds.notes[0]).toContain('Nothing was changed for you');

    const asMilliseconds = readingOf('1749900000', 'milliseconds');

    expect(asMilliseconds.instant.utc).toBe('1970-01-21 06:05:00 UTC');
    expect(asMilliseconds.notes[0]).toContain('usually seconds');
  });

  it('says nothing about a number that agrees with its unit, or about the epoch', () => {
    expect(readingOf('1749900000', 'seconds').notes).toEqual([]);
    expect(readingOf('1749900000000', 'milliseconds').notes).toEqual([]);
    expect(readingOf('0', 'milliseconds').notes).toEqual([]);
  });

  it('puts the boundary where the two readings swap plausibility', () => {
    expect(unitBoundary).toBe(100_000_000_000);
    expect(readingOf(String(unitBoundary - 1), 'seconds').notes).toEqual([]);
    expect(readingOf(String(unitBoundary), 'seconds').notes[0]).toContain('usually milliseconds');
    expect(readingOf(String(unitBoundary), 'milliseconds').notes).toEqual([]);
    expect(readingOf(String(unitBoundary - 1), 'milliseconds').notes[0]).toContain('usually seconds');
  });

  it('refuses what is not a count at all, and points at the other box', () => {
    expect(refusalOf('2026-09-07')).toContain('a date belongs in the other box');
    expect(refusalOf('yesterday')).toContain('not a count');
    expect(refusalOf('0x1f')).toContain('not a count');
    expect(refusalOf('1e9')).toContain('not a count');
  });

  it('refuses a moment beyond every calendar, and says which calendar', () => {
    expect(refusalOf('8640000000001', 'seconds')).toContain('275760');
    expect(refusalOf('8640000000000001', 'milliseconds')).toContain('275760');
    // The far edge itself is still a moment.
    expect(readingOf('8640000000000000', 'milliseconds').instant.seconds).toBe(8_640_000_000_000);
  });
});

describe('reading a written date', () => {
  it('treats an empty field as a question not yet asked', () => {
    expect(readDateTime('', 'utc')).toBeUndefined();
  });

  it('reads a date and a time in UTC exactly', () => {
    const reading = dateOf('2026-09-07T09:15:00');

    expect(reading.instant.milliseconds).toBe(now);
    expect(reading.instant.seconds).toBe(Math.floor(now / 1000));
    expect(reading.source).toBe('utc');
    expect(reading.offset).toBe('+00:00');
  });

  it('takes a space where the specification wants a T, since that is what people type', () => {
    expect(dateOf('2026-09-07 09:15').instant.milliseconds).toBe(now);
    expect(dateOf('2026-09-07 09:15:00.500').instant.milliseconds).toBe(now + 500);
  });

  it('reads a bare date as midnight, and says which midnight', () => {
    const reading = dateOf('2026-09-07');

    expect(reading.instant.milliseconds).toBe(Date.UTC(2026, 8, 7));
    expect(reading.notes[0]).toContain('midnight UTC');
  });

  it('lets an offset in the text outrank the setting, and says it did', () => {
    const reading = dateOf('2026-09-07T12:15:00+03:00', 'local');

    expect(reading.instant.milliseconds).toBe(now);
    expect(reading.source).toBe('offset');
    expect(reading.offset).toBe('+03:00');
    expect(reading.notes[0]).toContain('rather than the setting above');
    expect(dateOf('2026-09-07T09:15:00Z', 'local').instant.milliseconds).toBe(now);
    expect(dateOf('2026-09-07T04:15:00-0500').instant.milliseconds).toBe(now);
  });

  // Whatever zone the machine is set to, a wall clock read as local and
  // written back as local has to come out unchanged.
  it('reads a local wall clock as this device would, on any machine', () => {
    const reading = dateOf('2026-09-07 09:15:00', 'local');

    expect(reading.source).toBe('local');
    expect(reading.instant.local).toBe('2026-09-07 09:15:00');
    expect(reading.instant.milliseconds).toBe(
      now - getLocalOffsetMinutes(new Date(now)) * 60_000,
    );
  });

  it('refuses a shape it does not read, and shows the ones it does', () => {
    expect(dateRefusalOf('07/09/2026')).toContain('2026-09-07');
    expect(dateRefusalOf('2026-9-7')).toContain('not a date this reads');
    expect(dateRefusalOf('next tuesday')).toContain('not a date this reads');
  });

  it('checks the calendar rather than letting a date roll over into the next month', () => {
    expect(dateRefusalOf('2026-02-30')).toBe('February 2026 has 28 days, so there is no 30th.');
    expect(dateOf('2024-02-29').instant.utc).toBe('2024-02-29 00:00:00 UTC');
    expect(dateRefusalOf('2023-02-29')).toContain('February 2023 has 28 days');
    expect(dateRefusalOf('2026-13-01')).toBe('There is no month 13. A year has twelve.');
    expect(dateRefusalOf('2026-00-01')).toContain('no month 0');
  });

  it('knows the length of a month, leap years included', () => {
    expect(getMonthLength(2026, 2)).toBe(28);
    expect(getMonthLength(2024, 2)).toBe(29);
    expect(getMonthLength(1900, 2)).toBe(28);
    expect(getMonthLength(2000, 2)).toBe(29);
    expect(getMonthLength(2026, 9)).toBe(30);
  });

  it('refuses an impossible clock, and names the leap second for what it is', () => {
    expect(dateRefusalOf('2026-09-07T25:00:00')).toBe('There is no hour 25. A day runs 00 to 23.');
    expect(dateRefusalOf('2026-09-07T23:60:00')).toContain('run 00 to 59');
    expect(dateRefusalOf('2016-12-31T23:59:60Z')).toContain('A leap second is real');
  });
});

describe('the moment the page starts from', () => {
  it('writes now into either field without reading a clock of its own', () => {
    expect(formatTimestampInput(now, 'seconds')).toBe('1788772500');
    expect(formatTimestampInput(now, 'milliseconds')).toBe('1788772500000');
    expect(formatDateTimeInput(now, 'utc')).toBe('2026-09-07 09:15:00');
  });

  it('hands back a field its own parser reads, in either zone', () => {
    for (const zone of ['utc', 'local'] as const) {
      expect(dateOf(formatDateTimeInput(now, zone), zone).instant.milliseconds).toBe(now);
    }
  });

  it('declines to describe a moment that is not one', () => {
    expect(describeInstant(Number.NaN)).toBeUndefined();
    expect(describeInstant(8_640_000_000_000_001)).toBeUndefined();
  });
});
