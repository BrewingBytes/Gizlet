/**
 * Campaign links: a destination address with the five `utm_` parameters on it.
 *
 * The whole of this Gizlet is a function over two strings and five more, and
 * it lives here so it can be tested without a browser. Parsing is the
 * platform's own `URL`, and the parameters are written by `URLSearchParams`:
 * a second opinion about what an address means would only be a way to
 * disagree with the browser that eventually opens it.
 *
 * What is decided here rather than left to those two is everything a person
 * would otherwise find out the hard way. Only an absolute `http:` or `https:`
 * address is accepted, so a `javascript:` or `data:` link can never come out
 * of this looking like a campaign. The query the address already carries is
 * kept as it was written, key for key and byte for byte, rather than
 * re-serialised. And every `utm_` key this Gizlet manages is taken out before
 * the new values go on, so a pasted link that was already tagged — once, or
 * twice by two different people — comes out tagged exactly once.
 *
 * Nothing here fetches, shortens, or opens the address. It is text in and text
 * out, which is the only reason the page can say it stays on the device.
 */

/** The five fields, in the order the parameters are written. */
export const utmFields = ['source', 'medium', 'campaign', 'term', 'content'] as const;

export type UtmField = (typeof utmFields)[number];

/** The query key each field is written under. */
export type UtmParameter = `utm_${UtmField}`;

export type UtmValues = Readonly<Record<UtmField, string>>;

export interface UtmFieldDetail {
  readonly field: UtmField;
  readonly parameter: UtmParameter;
  readonly label: string;
  readonly required: boolean;
  readonly placeholder: string;
  /** What the value is for, in the words of the job rather than of the standard. */
  readonly hint: string;
}

export const utmFieldDetails = [
  {
    field: 'source',
    parameter: 'utm_source',
    label: 'Source',
    required: true,
    placeholder: 'newsletter',
    hint: 'Where the link is posted or sent: newsletter, linkedin, a partner’s site.',
  },
  {
    field: 'medium',
    parameter: 'utm_medium',
    label: 'Medium',
    required: true,
    placeholder: 'email',
    hint: 'The kind of channel: email, social, cpc, referral.',
  },
  {
    field: 'campaign',
    parameter: 'utm_campaign',
    label: 'Campaign',
    required: true,
    placeholder: 'autumn-launch',
    hint: 'The name the campaign is reported under, the same on every link that belongs to it.',
  },
  {
    field: 'term',
    parameter: 'utm_term',
    label: 'Term',
    required: false,
    placeholder: 'running shoes',
    hint: 'Optional. The paid search keyword, for a link in an ad.',
  },
  {
    field: 'content',
    parameter: 'utm_content',
    label: 'Content',
    required: false,
    placeholder: 'header-button',
    hint: 'Optional. Tells apart two links in the same message, such as a button and a text link.',
  },
] as const satisfies readonly UtmFieldDetail[];

/** The keys this Gizlet owns. Any of them already in the address is replaced. */
export const utmParameters: readonly UtmParameter[] = utmFieldDetails.map((detail) => detail.parameter);

export const emptyUtmValues: UtmValues = { source: '', medium: '', campaign: '', term: '', content: '' };

export function getUtmFieldDetail(field: UtmField): UtmFieldDetail {
  return utmFieldDetails.find((detail) => detail.field === field) ?? utmFieldDetails[0];
}

/** The only schemes a campaign link may have. Anything else is not a web page. */
const allowedProtocols = ['http:', 'https:'];

export type DestinationProblem =
  | { readonly kind: 'empty' }
  /** No scheme, or not an address at all. `suggestion` is set when adding `https://` would make it one. */
  | { readonly kind: 'not-absolute'; readonly suggestion?: string }
  | { readonly kind: 'unsupported-scheme'; readonly scheme: string };

export type DestinationResult =
  | { readonly ok: true; readonly url: URL }
  | { readonly ok: false; readonly problem: DestinationProblem };

function parseAbsolute(text: string): URL | undefined {
  try {
    return new URL(text);
  } catch {
    return undefined;
  }
}

/**
 * Reads the destination the visitor typed, refusing anything that is not an
 * absolute web address.
 *
 * `new URL` is called without a base on purpose: with one, `/pricing` and
 * `example.com` would quietly become addresses on whatever site the base
 * named. Without one they fail, and the page says what to add.
 */
export function parseDestination(raw: string): DestinationResult {
  const text = raw.trim();

  if (text === '') return { ok: false, problem: { kind: 'empty' } };

  // `example.com:8080/shop` parses, as an address whose scheme is
  // `example.com`. A host and a port is what the visitor meant, so it is read
  // as an address with its scheme left off.
  const hostAndPort = /^[^\s/:?#]+:\d+(?:[/?#]|$)/.test(text);
  const url = hostAndPort ? undefined : parseAbsolute(text);

  if (!url) {
    const hasScheme = !hostAndPort && /^[a-z][a-z0-9+.-]*:/i.test(text);
    const guess = hasScheme || text.startsWith('/') ? undefined : parseAbsolute(`https://${text}`);
    // A guess is only offered when it really has a host with a dot in it, so
    // `pricing` alone is not turned into a link to a machine called pricing.
    const suggestion = guess && guess.hostname.includes('.') ? guess.href : undefined;

    return { ok: false, problem: suggestion ? { kind: 'not-absolute', suggestion } : { kind: 'not-absolute' } };
  }

  if (!allowedProtocols.includes(url.protocol)) {
    return { ok: false, problem: { kind: 'unsupported-scheme', scheme: url.protocol.slice(0, -1) } };
  }

  return { ok: true, url };
}

export function describeDestinationProblem(problem: DestinationProblem): string {
  switch (problem.kind) {
    case 'empty':
      return 'Paste the address the link should open.';
    case 'not-absolute':
      return problem.suggestion
        ? `That is not a whole address. Start it with https:// — for example ${problem.suggestion}`
        : 'That is not a whole address. Start it with https:// and the site’s name.';
    case 'unsupported-scheme':
      return `A ${problem.scheme}: link is not a web page, so it cannot carry a campaign. Use an http:// or https:// address.`;
  }
}

/**
 * The key of one `&`-separated piece of a query, decoded the way the browser
 * decodes it. `URLSearchParams` does the decoding, so `utm%5Fsource` and
 * `utm_source` are recognised as the same key, exactly as an analytics script
 * reading the page would recognise them.
 */
function queryPieceKey(piece: string): string {
  const [first] = new URLSearchParams(piece).keys();

  return first ?? '';
}

function isUtmParameter(key: string): key is UtmParameter {
  return (utmParameters as readonly string[]).includes(key);
}

/**
 * The managed parameters, written by `URLSearchParams`.
 *
 * It writes a space as `+`, which is right for a form and read as a space by
 * every analytics script that reads a query — and as a literal plus by some
 * that read a URL more strictly. A plus in a value is always escaped to `%2B`
 * first, so every `+` left in the output is a space, and writing it as `%20`
 * instead means it is a space to every reader.
 */
function serializeUtmValues(values: UtmValues): string {
  const params = new URLSearchParams();

  for (const detail of utmFieldDetails) {
    const value = values[detail.field].trim();

    if (value !== '') params.append(detail.parameter, value);
  }

  return params.toString().replaceAll('+', '%20');
}

export type CampaignUrlResult =
  | {
      readonly ok: true;
      readonly url: string;
      /** Managed keys the destination already had, and which now hold the new values. */
      readonly replaced: readonly UtmParameter[];
      /** Managed keys the destination had that are now gone, because their field was left empty. */
      readonly removed: readonly UtmParameter[];
      /** How many managed keys the destination repeated, each counted once per extra copy. */
      readonly duplicatesDropped: number;
    }
  | {
      readonly ok: false;
      /** Absent when the destination is fine and only fields are missing. */
      readonly destination?: DestinationProblem;
      readonly missing: readonly UtmField[];
    };

/**
 * The campaign link for a destination and five values.
 *
 * The destination's own query is kept piece by piece in its original order and
 * spelling, minus every managed key, and the managed keys follow it in the
 * fixed order source, medium, campaign, term, content. An optional field that
 * is empty writes nothing, and an old value under its key is removed rather
 * than kept: a link that mixed last month's term with this month's campaign
 * would be reported as neither. The fragment stays at the end, where a
 * fragment has to be.
 */
export function buildCampaignUrl(destination: string, values: UtmValues): CampaignUrlResult {
  const parsed = parseDestination(destination);
  const missing = utmFieldDetails
    .filter((detail) => detail.required && values[detail.field].trim() === '')
    .map((detail) => detail.field);

  if (!parsed.ok) return { ok: false, destination: parsed.problem, missing };
  if (missing.length > 0) return { ok: false, missing };

  const url = new URL(parsed.url.href);
  const kept: string[] = [];
  const seen = new Map<UtmParameter, number>();

  for (const piece of url.search.slice(1).split('&')) {
    if (piece === '') continue;

    const key = queryPieceKey(piece);

    if (isUtmParameter(key)) {
      seen.set(key, (seen.get(key) ?? 0) + 1);
    } else {
      kept.push(piece);
    }
  }

  const managed = serializeUtmValues(values);

  url.search = [...kept, ...(managed === '' ? [] : [managed])].join('&');

  const written = (parameter: UtmParameter) =>
    values[utmFieldDetails.find((detail) => detail.parameter === parameter)!.field].trim() !== '';
  const previous = utmParameters.filter((parameter) => seen.has(parameter));

  return {
    ok: true,
    url: url.href,
    replaced: previous.filter(written),
    removed: previous.filter((parameter) => !written(parameter)),
    duplicatesDropped: [...seen.values()].reduce((total, count) => total + count - 1, 0),
  };
}

function listParameters(parameters: readonly string[]): string {
  if (parameters.length <= 1) return parameters.join('');

  return `${parameters.slice(0, -1).join(', ')} and ${parameters.at(-1)}`;
}

/** The sentence under the result, saying what was done to the address. */
export function describeCampaignUrl(result: CampaignUrlResult): string {
  if (!result.ok) {
    // The problem itself is shown beside the address, so this only points at it.
    if (result.destination && result.destination.kind !== 'empty') {
      return 'Fix the destination address to build the link.';
    }

    const needed = [
      ...(result.destination ? ['a destination'] : []),
      ...result.missing.map((field) => `a ${getUtmFieldDetail(field).label.toLowerCase()}`),
    ];

    return `Add ${listParameters(needed)} to build the link.`;
  }

  const notes = ['Built on this device. Nothing was opened or fetched.'];

  if (result.replaced.length > 0) {
    notes.push(`Replaced the ${listParameters(result.replaced)} the address already had.`);
  }

  if (result.removed.length > 0) {
    notes.push(`Removed the old ${listParameters(result.removed)}, because that field is empty.`);
  }

  if (result.duplicatesDropped > 0) {
    notes.push(
      result.duplicatesDropped === 1
        ? 'One repeated utm_ key was dropped, so each appears once.'
        : `${result.duplicatesDropped} repeated utm_ keys were dropped, so each appears once.`,
    );
  }

  return notes.join(' ');
}

/**
 * Fields whose value has a capital letter in it. Most analytics tools count
 * `Newsletter` and `newsletter` as two sources, so this is worth a word —
 * and only a word: the value is written exactly as typed.
 */
export function getMixedCaseFields(values: UtmValues): readonly UtmField[] {
  return utmFields.filter((field) => values[field] !== values[field].toLowerCase());
}
