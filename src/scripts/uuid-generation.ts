import {
  buildMaxUuid,
  buildNilUuid,
  buildRandomNode,
  buildUuidV1,
  buildUuidV3,
  buildUuidV4,
  buildUuidV6,
  buildUuidV7,
  finishNameBasedUuid,
  maximumUuidV7Counter,
  parseUuid,
  toNameBasedInput,
  type UuidKind,
} from '../data/uuid';

/**
 * The part of making a UUID that needs a browser: the randomness, and SHA-1.
 *
 * Every bit layout lives in `data/uuid`, which takes the bytes it needs as
 * arguments and has no source of entropy at all. That is deliberate — a
 * generator that reaches for randomness inside itself cannot be tested against
 * a known answer. Here is where `crypto.getRandomValues` is actually called.
 *
 * Never `Math.random()`. It is seeded from the clock, its output is
 * predictable from a handful of samples, and identifiers guessable by anyone
 * who has seen a few of them are not identifiers.
 */

export function hasSecureRandom(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function';
}

export function getInsecureRandomMessage(): string {
  return 'This browser offers no cryptographic randomness, so nothing is generated here. A predictable identifier is worse than none, and Math.random() is predictable.';
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);

  crypto.getRandomValues(bytes);

  return bytes;
}

/**
 * The clock state versions 1 and 6 need.
 *
 * A browser clock stops at the millisecond and those versions count hundred-
 * nanosecond intervals, so the interval is a counter: it advances for each
 * UUID made within the same millisecond and resets when the millisecond does.
 * Without it, a thousand UUIDs made in one tick would be one UUID a thousand
 * times.
 *
 * The clock sequence is random per page rather than persisted. RFC 9562 allows
 * that where the clock is coarse, and the alternative — keeping a counter in
 * storage — would mean this Gizlet remembering something about the visitor,
 * which is a strange trade for a value nobody reads.
 */
interface Clock {
  sequence: number;
  milliseconds: number;
  interval: number;
}

function createClock(): Clock {
  const [high, low] = randomBytes(2);

  return { sequence: ((high << 8) | low) & 0x3fff, milliseconds: -1, interval: 0 };
}

function tick(clock: Clock, now: number): { milliseconds: number; interval: number } {
  if (now !== clock.milliseconds) {
    clock.milliseconds = now;
    clock.interval = 0;
  } else {
    clock.interval += 1;

    // 10,000 intervals is a whole millisecond's worth. Past that the sequence
    // changes instead, which is what the field is for.
    if (clock.interval > 9_999) {
      clock.interval = 0;
      clock.sequence = (clock.sequence + 1) & 0x3fff;
    }
  }

  return { milliseconds: clock.milliseconds, interval: clock.interval };
}

/**
 * The counter that keeps a batch of version 7s in order.
 *
 * Reseeded on each new millisecond rather than reset to zero, which is what
 * RFC 9562 suggests: a counter that always starts at zero makes those twelve
 * bits predictable. Seeding into the bottom quarter leaves room for three
 * thousand more in the same millisecond, which no browser will reach.
 */
interface V7Counter {
  value: number;
  milliseconds: number;
}

function seed(): number {
  const [high, low] = randomBytes(2);

  return ((high << 8) | low) & 0x03ff;
}

function createV7Counter(): V7Counter {
  return { value: seed(), milliseconds: -1 };
}

function advanceV7Counter(counter: V7Counter, now: number): number {
  if (now !== counter.milliseconds) {
    counter.milliseconds = now;
    counter.value = seed();
  } else if (counter.value < maximumUuidV7Counter) {
    counter.value += 1;
  }

  // At the ceiling the counter holds rather than wrapping: a wrap would put a
  // later UUID before an earlier one, which is the one thing this must not do.
  return counter.value;
}

export interface UuidRequest {
  readonly kind: UuidKind;
  readonly count: number;
  /** For the name-based versions: sixteen bytes of namespace, and the name. */
  readonly namespace?: Uint8Array;
  readonly name?: string;
}

/**
 * A version 4 from the platform's own generator where there is one.
 *
 * `crypto.randomUUID` is the same randomness as `getRandomValues` with the
 * bits already stamped, so this is not about quality — it is about using what
 * the browser provides rather than reimplementing it beside it. Parsing the
 * string back to bytes costs nothing and keeps one formatting path.
 */
function makeV4(): Uint8Array {
  if (typeof crypto.randomUUID === 'function') {
    const parsed = parseUuid(crypto.randomUUID());

    if (parsed) return parsed;
  }

  return buildUuidV4(randomBytes(16));
}

/**
 * The requested UUIDs, as bytes.
 *
 * A name-based request yields the same value every time, which is the whole
 * point of those versions — so asking for ten of a version 5 gives ten copies
 * of one UUID, and the page says so rather than pretending they differ.
 */
export async function generateUuids(request: UuidRequest): Promise<readonly Uint8Array[]> {
  if (!hasSecureRandom()) throw new Error(getInsecureRandomMessage());

  const { kind, count } = request;

  if (kind === 'nil') return Array.from({ length: count }, buildNilUuid);
  if (kind === 'max') return Array.from({ length: count }, buildMaxUuid);
  if (kind === 'v4') return Array.from({ length: count }, makeV4);

  if (kind === 'v7') {
    // The timestamp is read once per UUID rather than once per batch, so a long
    // run sorts by when each one was actually made — and the counter orders the
    // ones that land inside the same millisecond, which in a batch is most of
    // them.
    const counter = createV7Counter();

    return Array.from({ length: count }, () => {
      const now = Date.now();

      return buildUuidV7(now, advanceV7Counter(counter, now), randomBytes(8));
    });
  }

  if (kind === 'v1' || kind === 'v6') {
    const clock = createClock();
    // One node for the whole batch, as a machine would have one — random, and
    // flagged as not a real address, because a browser cannot read a MAC.
    const node = buildRandomNode(randomBytes(6));
    const build = kind === 'v1' ? buildUuidV1 : buildUuidV6;

    return Array.from({ length: count }, () => {
      const moment = tick(clock, Date.now());

      return build({ ...moment, clockSequence: clock.sequence, node });
    });
  }

  const { namespace, name } = request;

  if (!namespace || name === undefined) {
    throw new Error('A name-based UUID needs a namespace and a name.');
  }

  if (kind === 'v3') {
    const bytes = buildUuidV3(namespace, name);

    return Array.from({ length: count }, () => bytes);
  }

  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', toNameBasedInput(namespace, name)));
  const bytes = finishNameBasedUuid(digest, 5);

  return Array.from({ length: count }, () => bytes);
}
