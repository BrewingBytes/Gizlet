import { describe, expect, it } from 'vitest';

import {
  describeLocalZone,
  describeTimeGap,
  formatIsoInstant,
  formatLocalInstant,
  formatUtcInstant,
  formatUtcOffset,
  formatWeekday,
  getLocalOffsetMinutes,
  isInstant,
  maximumInstantMilliseconds,
} from '../../src/data/instant';

/** 2026-09-07 09:15:00 UTC, as a clock and as a count of seconds. */
const now = Date.UTC(2026, 8, 7, 9, 15, 0);
const nowSeconds = Math.floor(now / 1000);

const notAMoment = new Date(Number.NaN);

describe('writing a moment down', () => {
  it('writes UTC the one way both Gizlets write it', () => {
    expect(formatUtcInstant(new Date(now))).toBe('2026-09-07 09:15:00 UTC');
    expect(formatUtcInstant(new Date(0))).toBe('1970-01-01 00:00:00 UTC');
  });

  it('keeps a year before 1970 four digits wide rather than losing its padding', () => {
    expect(formatUtcInstant(new Date(Date.UTC(875, 0, 2, 3, 4, 5)))).toBe(
      '0875-01-02 03:04:05 UTC',
    );
  });

  it('writes ISO 8601 without the milliseconds nobody wanted', () => {
    expect(formatIsoInstant(new Date(now))).toBe('2026-09-07T09:15:00Z');
    expect(formatIsoInstant(new Date(now + 250))).toBe('2026-09-07T09:15:00.250Z');
  });

  it('names the weekday in the zone it was asked about', () => {
    expect(formatWeekday(new Date(now), 'utc')).toBe('Monday');
    expect(formatWeekday(new Date(Date.UTC(2026, 8, 6)), 'utc')).toBe('Sunday');
  });

  it('declines to write a date that is not one, rather than apologising for it', () => {
    expect(isInstant(notAMoment)).toBe(false);
    expect(isInstant(new Date(now))).toBe(true);
    expect(formatUtcInstant(notAMoment)).toBeUndefined();
    expect(formatLocalInstant(notAMoment)).toBeUndefined();
    expect(formatIsoInstant(notAMoment)).toBeUndefined();
    expect(formatWeekday(notAMoment, 'utc')).toBeUndefined();
  });

  it('knows how far a Date reaches', () => {
    expect(isInstant(new Date(maximumInstantMilliseconds))).toBe(true);
    expect(isInstant(new Date(maximumInstantMilliseconds + 1))).toBe(false);
  });
});

describe('offsets', () => {
  it('writes an offset east-positive, which is the way a person reads one', () => {
    expect(formatUtcOffset(180)).toBe('+03:00');
    expect(formatUtcOffset(-330)).toBe('-05:30');
    expect(formatUtcOffset(0)).toBe('+00:00');
    expect(formatUtcOffset(-45)).toBe('-00:45');
  });

  it('turns the sign of getTimezoneOffset round, since it counts the other way', () => {
    const moment = new Date(now);

    expect(getLocalOffsetMinutes(moment)).toBe(-moment.getTimezoneOffset());
    expect(describeLocalZone(moment)).toBe(
      `UTC${formatUtcOffset(-moment.getTimezoneOffset())}`,
    );
  });

  // Whatever zone the machine running this is set to, the two renderings have
  // to describe the same moment — which is the property a wrong sign breaks.
  it('agrees with itself about local time, on any machine', () => {
    const moment = new Date(now);
    const local = new Date(now + getLocalOffsetMinutes(moment) * 60_000);

    expect(formatLocalInstant(moment)).toBe(formatUtcInstant(local)?.replace(' UTC', ''));
  });
});

describe('describeTimeGap', () => {
  it('says how far away a moment is, in the unit a person would use', () => {
    expect(describeTimeGap(nowSeconds, now)).toBe('in a moment');
    expect(describeTimeGap(nowSeconds - 10, now)).toBe('moments ago');
    expect(describeTimeGap(nowSeconds + 60, now)).toBe('in 1 minute');
    expect(describeTimeGap(nowSeconds - 600, now)).toBe('10 minutes ago');
    expect(describeTimeGap(nowSeconds + 3600, now)).toBe('in 1 hour');
    expect(describeTimeGap(nowSeconds + 7200, now)).toBe('in 2 hours');
    expect(describeTimeGap(nowSeconds - 3 * 86400, now)).toBe('3 days ago');
    expect(describeTimeGap(nowSeconds + 90 * 86400, now)).toBe('in 3 months');
    expect(describeTimeGap(nowSeconds + 3 * 365 * 86400, now)).toBe('in 3 years');
  });

  it('uses one unit and never two', () => {
    expect(describeTimeGap(nowSeconds - (2 * 3600 + 14 * 60), now)).toBe('2 hours ago');
  });
});
