/**
 * Writing a moment down.
 *
 * This exists because two Gizlets need the same sentences about time and were
 * going to word them differently. JWT Decoder reads the dates a token carries;
 * Timestamp Converter is about nothing else. Both have to render a moment in
 * UTC, and both have to say how far away it is in words, and a project where
 * one says `2026-09-07 09:15:00 UTC` and the other says `Sep 7, 2026, 9:15 AM`
 * is a project that looks like two projects.
 *
 * Nothing here reads the clock. `describeTimeGap` takes the current time as a
 * parameter, because a function that calls `Date.now()` inside itself is a
 * function whose tests are either flaky or elaborate, and every caller has a
 * clock to hand anyway.
 *
 * The names are written out rather than fetched from `Intl`. A weekday from
 * `Intl` follows the visitor's locale, which means the same moment reads
 * differently on two devices and a test asserts whatever the machine running
 * it happens to be set to. These pages are in English and say so.
 */

/** The furthest a `Date` reaches: ±100,000,000 days, which is ±year 275760. */
export const maximumInstantMilliseconds = 8_640_000_000_000_000;

const weekdayNames = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const pad = (part: number, width = 2) => String(part).padStart(width, '0');

/** Whether a `Date` is a moment at all, rather than the result of a bad sum. */
export function isInstant(moment: Date): boolean {
  return !Number.isNaN(moment.getTime());
}

/**
 * `2026-09-07 09:15:00 UTC`.
 *
 * Nothing is returned for a date that is not one, rather than a sentence
 * apologising for it: what to say instead depends on why the caller was
 * looking, and a token's impossible expiry and a typed-in year 900000 want
 * different words.
 */
export function formatUtcInstant(moment: Date): string | undefined {
  if (!isInstant(moment)) return undefined;

  return `${pad(moment.getUTCFullYear(), 4)}-${pad(moment.getUTCMonth() + 1)}-${pad(moment.getUTCDate())} ${pad(moment.getUTCHours())}:${pad(moment.getUTCMinutes())}:${pad(moment.getUTCSeconds())} UTC`;
}

/** The same moment as this device's own clock shows it, without a zone name. */
export function formatLocalInstant(moment: Date): string | undefined {
  if (!isInstant(moment)) return undefined;

  return `${pad(moment.getFullYear(), 4)}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())} ${pad(moment.getHours())}:${pad(moment.getMinutes())}:${pad(moment.getSeconds())}`;
}

/**
 * ISO 8601, in UTC, which is the one form every other program will accept.
 *
 * `toISOString` writes the milliseconds always; they are dropped when they are
 * zero, because `2026-09-07T09:15:00Z` is what a person pastes and the `.000`
 * only ever gets deleted by hand.
 */
export function formatIsoInstant(moment: Date): string | undefined {
  if (!isInstant(moment)) return undefined;

  const iso = moment.toISOString();

  return iso.endsWith('.000Z') ? `${iso.slice(0, -5)}Z` : iso;
}

export function formatWeekday(moment: Date, zone: 'utc' | 'local'): string | undefined {
  if (!isInstant(moment)) return undefined;

  return weekdayNames[zone === 'utc' ? moment.getUTCDay() : moment.getDay()];
}

/**
 * `+03:00`, from minutes east of UTC.
 *
 * `getTimezoneOffset` counts the other way — minutes to *add* to local time to
 * reach UTC — so a caller passing it straight in would label Bucharest as
 * `-03:00`. That is the whole reason this takes a signed number and is written
 * once rather than at each call.
 */
export function formatUtcOffset(minutesEastOfUtc: number): string {
  const sign = minutesEastOfUtc < 0 ? '-' : '+';
  const magnitude = Math.abs(minutesEastOfUtc);

  return `${sign}${pad(Math.floor(magnitude / 60))}:${pad(magnitude % 60)}`;
}

/** How far this device's clock is from UTC at this moment, east-positive. */
export function getLocalOffsetMinutes(moment: Date): number {
  return -moment.getTimezoneOffset();
}

/** `UTC+03:00`, as a zone is labelled when it has no name worth printing. */
export function describeLocalZone(moment: Date): string {
  return `UTC${formatUtcOffset(getLocalOffsetMinutes(moment))}`;
}

const gapUnits = [
  { limit: 45 * 60, divisor: 60, name: 'minute' },
  { limit: 36 * 3600, divisor: 3600, name: 'hour' },
  { limit: 45 * 86400, divisor: 86400, name: 'day' },
  { limit: 550 * 86400, divisor: 30 * 86400, name: 'month' },
] as const;

/**
 * How far a moment is from now, in words: `in 3 days`, `2 hours ago`.
 *
 * One unit, chosen by magnitude, and no second one after it. `2 hours and 14
 * minutes ago` is more precise and less readable, and the exact moment is
 * always printed beside this anyway.
 */
export function describeTimeGap(seconds: number, now: number): string {
  const difference = seconds - Math.floor(now / 1000);
  const magnitude = Math.abs(difference);

  if (magnitude < 30) return difference >= 0 ? 'in a moment' : 'moments ago';

  const unit = gapUnits.find((candidate) => magnitude < candidate.limit);
  const count = unit
    ? Math.round(magnitude / unit.divisor)
    : Math.round((magnitude / (365 * 86400)) * 10) / 10;
  const name = unit ? unit.name : 'year';
  const text = `${count.toLocaleString()} ${name}${count === 1 ? '' : 's'}`;

  return difference >= 0 ? `in ${text}` : `${text} ago`;
}
