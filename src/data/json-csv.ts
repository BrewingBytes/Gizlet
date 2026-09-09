import { formatJsonParseError, validateJson } from './json-formatter';

/**
 * Records moved between JSON and CSV, in both directions.
 *
 * The two formats disagree about almost everything, and every disagreement
 * here is answered the same way: say what was done rather than do something
 * clever. CSV has no types, so a cell that reads `007` is either the string
 * `007` or the number seven and nothing in the file settles which — that is a
 * control the visitor sets, and the default is the one that loses nothing.
 * CSV has no nesting either, so an object inside a row is refused by name
 * instead of being flattened into columns this would have to invent names for.
 *
 * Nothing is parsed with `split(',')`. A comma inside a quoted value is a
 * comma, a doubled quote inside one is a quote, and a value can hold a line
 * break — which is the whole of RFC 4180 and the whole of why the naive
 * version is wrong on the first real spreadsheet it meets. The reader here is
 * a character state machine for that reason, and the writer quotes on the same
 * rules so a document written here reads back as itself.
 *
 * The one thing that does not survive a round trip is `null`, and it is said
 * out loud rather than hidden: a spreadsheet has no null, so a null becomes an
 * empty cell, and an empty cell is an empty string on the way back.
 */

/** What separates two fields. A small closed set, because a guess is worse. */
export const csvDelimiters = ['comma', 'semicolon', 'tab', 'pipe'] as const;

export type CsvDelimiter = (typeof csvDelimiters)[number];

export interface CsvDelimiterDetail {
  readonly id: CsvDelimiter;
  readonly label: string;
  /** The single character itself, which is the whole of the difference. */
  readonly character: string;
  readonly note: string;
}

export const csvDelimiterDetails: readonly CsvDelimiterDetail[] = [
  {
    id: 'comma',
    label: 'Comma',
    character: ',',
    note: 'What CSV is named after, and what nearly everything means by it.',
  },
  {
    id: 'semicolon',
    label: 'Semicolon',
    character: ';',
    note: 'What a spreadsheet saves in a locale where the comma is already the decimal point, which is most of Europe. If a file opens in Excel as one tall column, this is usually the reason.',
  },
  {
    id: 'tab',
    label: 'Tab',
    character: '\t',
    note: 'TSV, and what you get pasting a range straight out of a spreadsheet. Almost nothing needs quoting, because a tab rarely turns up inside a value.',
  },
  {
    id: 'pipe',
    label: 'Pipe',
    character: '|',
    note: 'Common in database dumps and log exports, for the same reason as the tab: it is a character real data hardly ever contains.',
  },
];

export const defaultCsvDelimiter: CsvDelimiter = 'comma';

export function isCsvDelimiter(value: string): value is CsvDelimiter {
  return csvDelimiters.includes(value as CsvDelimiter);
}

export function getCsvDelimiter(id: CsvDelimiter): CsvDelimiterDetail {
  const detail = csvDelimiterDetails.find((candidate) => candidate.id === id);

  if (!detail) throw new Error(`Missing CSV delimiter: ${id}`);

  return detail;
}

/**
 * What a cell becomes on the way into JSON.
 *
 * This is the seconds-or-milliseconds problem wearing a different hat. A CSV
 * carries no types at all, so every cell is text until somebody decides
 * otherwise, and deciding for you is wrong for the person whose product codes
 * are `00713`. The control says who decides, and the default is the reading
 * that cannot lose anything.
 */
export const csvValueReadings = ['text', 'typed'] as const;

export type CsvValueReading = (typeof csvValueReadings)[number];

export interface CsvValueReadingDetail {
  readonly id: CsvValueReading;
  readonly label: string;
  readonly note: string;
}

export const csvValueReadingDetails: readonly CsvValueReadingDetail[] = [
  {
    id: 'text',
    label: 'Text',
    note: 'Every cell becomes a string, exactly as it was written — a leading zero, a long identifier and a phone number all survive.',
  },
  {
    id: 'typed',
    label: 'Numbers and true, false, null',
    note: 'A cell that is exactly a JSON number, or true, false or null, becomes one; everything else stays text. 007 keeps its zero, and a number too long to hold exactly stays text rather than coming back as a different number.',
  },
];

export const defaultCsvValueReading: CsvValueReading = 'text';

export function isCsvValueReading(value: string): value is CsvValueReading {
  return csvValueReadings.includes(value as CsvValueReading);
}

export function getCsvValueReading(id: CsvValueReading): CsvValueReadingDetail {
  const detail = csvValueReadingDetails.find((candidate) => candidate.id === id);

  if (!detail) throw new Error(`Missing CSV value reading: ${id}`);

  return detail;
}

/**
 * RFC 4180 ends a record with CRLF, and a spreadsheet on Windows still cares.
 * The reader accepts all three endings, so nothing is lost by writing the one
 * the standard names.
 */
export const csvLineEnding = '\r\n';

/** What a converted document is offered as, since neither side has a name. */
export const csvDownloadName = 'records.csv';
export const jsonDownloadName = 'records.json';

/**
 * Whether a field can be written bare.
 *
 * Leading and trailing spaces are quoted too, which RFC 4180 does not require
 * and every spreadsheet appreciates: a bare ` yes` is read back with its space
 * by some readers and without it by others, and quoting settles it here.
 */
function needsQuoting(value: string, separator: string): boolean {
  return (
    value.includes(separator) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r') ||
    value.trim() !== value
  );
}

/** One field, quoted if it has to be, with its own quotes doubled. */
export function formatCsvField(value: string, separator: string): string {
  return needsQuoting(value, separator) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * One record as one line.
 *
 * A record of a single empty field would write as an empty line, and an empty
 * line is not a record when it is read back — it is indistinguishable from the
 * line ending the file already has. `""` is what RFC 4180 gives us to say one
 * empty value rather than nothing at all, so a one-column table with a blank
 * in it survives the trip. Every wider record already says it: `,` is two
 * fields whatever they hold.
 */
function formatCsvRow(row: readonly string[], separator: string): string {
  if (row.length === 1 && row[0] === '') return '""';

  return row.map((field) => formatCsvField(field, separator)).join(separator);
}

/** Rows written out as a document, header included — the caller supplies it. */
export function formatCsvRows(
  rows: readonly (readonly string[])[],
  separator: string,
): string {
  return rows.map((row) => formatCsvRow(row, separator)).join(csvLineEnding);
}

/** One record, and where it started, so an error can name a line. */
export interface CsvRecord {
  readonly fields: readonly string[];
  /** The 1-based line the record begins on. A quoted value can span several. */
  readonly line: number;
}

/**
 * A document read into records, one character at a time.
 *
 * Inside quotes everything is literal — the separator, a line break, and a
 * doubled quote which is one quote — and a quote only opens a field at its
 * start, so `a"b` is three characters rather than a parse error. A wholly
 * empty line carries no record; a line of nothing but separators does, because
 * those are real empty fields somebody wrote down.
 */
export function parseCsvRecords(text: string, separator: string): readonly CsvRecord[] {
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = '';
  let inQuotes = false;
  let everQuoted = false;
  let line = 1;
  let recordLine = 1;

  const endRecord = () => {
    if (fields.length > 0 || field !== '' || everQuoted) {
      fields.push(field);
      records.push({ fields, line: recordLine });
    }

    fields = [];
    field = '';
    everQuoted = false;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }

        continue;
      }

      if (char === '\n') line += 1;
      field += char;
      continue;
    }

    if (char === '"' && field === '') {
      inQuotes = true;
      everQuoted = true;
      continue;
    }

    if (char === separator) {
      fields.push(field);
      field = '';
      continue;
    }

    if (char === '\r' || char === '\n') {
      endRecord();
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      line += 1;
      recordLine = line;
      continue;
    }

    field += char;
  }

  endRecord();

  return records;
}

/** What a conversion produced, and everything it wants to say about it. */
export interface CsvConversion {
  readonly output: string;
  readonly columns: readonly string[];
  readonly rowCount: number;
  readonly notes: readonly string[];
}

export type CsvConversionResult =
  | { readonly ok: true; readonly conversion: CsvConversion }
  | { readonly ok: false; readonly message: string };

/** How many line or item numbers a note names before it starts counting. */
const listLimit = 5;

function joinNumbers(numbers: readonly number[]): string {
  const shown = numbers.slice(0, listLimit).map(String);
  const rest = numbers.length - shown.length;

  if (rest > 0) return `${shown.join(', ')} and ${rest} more`;
  if (shown.length === 1) return shown[0];

  return `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}`;
}

function describeLines(numbers: readonly number[]): string {
  return `${numbers.length === 1 ? 'Line' : 'Lines'} ${joinNumbers(numbers)}`;
}

function describeItems(numbers: readonly number[]): string {
  return `${numbers.length === 1 ? 'Item' : 'Items'} ${joinNumbers(numbers)}`;
}

function describeNames(names: readonly string[]): string {
  const shown = names.slice(0, listLimit).map((name) => `“${name}”`);
  const rest = names.length - shown.length;

  if (rest > 0) return `${shown.join(', ')} and ${rest} more`;
  if (shown.length === 1) return shown[0];

  return `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}`;
}

function describeJsonValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';

  switch (typeof value) {
    case 'object':
      return 'an object';
    case 'string':
      return 'a string';
    case 'number':
      return 'a number';
    case 'boolean':
      return 'true or false';
    default:
      return 'something JSON cannot hold';
  }
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** One JSON value as one cell. A null and a missing key are both nothing. */
function formatCsvCell(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;

  return String(value);
}

/**
 * Records turned into a table.
 *
 * An empty box is not a failure — it is a question nobody has asked yet — so
 * it comes back as `undefined` rather than as an error shown to somebody who
 * has typed nothing.
 */
export function convertJsonToCsv(
  input: string,
  delimiter: CsvDelimiter,
): CsvConversionResult | undefined {
  if (input.trim() === '') return undefined;

  const parsed = validateJson(input);

  if (!parsed.valid) {
    return { ok: false, message: formatJsonParseError(parsed.error) };
  }

  const value = parsed.value;

  if (!Array.isArray(value)) {
    return {
      ok: false,
      message: `The top level here is ${describeJsonValue(value)}, and a table is a list of rows. This reads an array of flat objects — [{"name": "Ada"}, {"name": "Grace"}] — so put square brackets around a single record.`,
    };
  }

  if (value.length === 0) {
    return {
      ok: false,
      message: 'The array is empty, so there are no keys to make columns out of and the CSV would be a blank file.',
    };
  }

  const rows: Record<string, unknown>[] = [];

  for (const [index, entry] of value.entries()) {
    if (!isRecordObject(entry)) {
      return {
        ok: false,
        message: `Item ${index + 1} is ${describeJsonValue(entry)}, and a row has to be an object with named fields — the names are what become the columns. Every item needs the same shape: {"name": "Ada", "born": 1815}.`,
      };
    }

    rows.push(entry);
  }

  // First appearance wins, so the column order is the order somebody reading
  // the JSON top to bottom would expect, and the same input always writes the
  // same file. A key only some rows carry lands where it first turns up.
  const columns: string[] = [];

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }

  if (columns.length === 0) {
    return {
      ok: false,
      message: 'Every object in the array is empty, so there is nothing to make a column out of.',
    };
  }

  for (const [index, row] of rows.entries()) {
    for (const key of columns) {
      const cell = row[key];

      if (cell !== null && typeof cell === 'object') {
        return {
          ok: false,
          message: `Item ${index + 1} has ${Array.isArray(cell) ? 'an array' : 'an object'} under “${key}”, and a cell holds one value. Flattening nested JSON means inventing names for the columns it becomes, which this will not guess at: flatten it yourself, or take the part that is already a table.`,
        };
      }
    }
  }

  const notes: string[] = [];
  const ragged = rows
    .map((row, index) => ({
      item: index + 1,
      missing: columns.filter((key) => !Object.hasOwn(row, key)),
    }))
    .filter((row) => row.missing.length > 0);

  if (ragged.length > 0) {
    const missing = [...new Set(ragged.flatMap((row) => row.missing))];

    notes.push(
      `${describeItems(ragged.map((row) => row.item))} ${ragged.length === 1 ? 'does' : 'do'} not carry every key the others do. The table keeps a column for ${describeNames(missing)} and writes an empty cell where the key was absent, so every row still has the same shape.`,
    );
  }

  if (rows.some((row) => columns.some((key) => row[key] === null))) {
    notes.push(
      'A null was written as an empty cell, which is what a spreadsheet has instead. Reading that file back gives an empty string rather than a null — it is the one value a round trip does not return.',
    );
  }

  const separator = getCsvDelimiter(delimiter).character;
  const output = formatCsvRows(
    [columns, ...rows.map((row) => columns.map((key) => formatCsvCell(row[key])))],
    separator,
  );

  return { ok: true, conversion: { output, columns, rowCount: rows.length, notes } };
}

/** The JSON number grammar, which is narrower than what `Number` accepts. */
const jsonNumber = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

/**
 * One cell as a JSON value.
 *
 * A number is only taken when writing it back out gives the same characters.
 * That is what keeps a 20-digit identifier and `1e3` as text: both are legal
 * JSON numbers and neither survives a trip through a double unchanged, and a
 * converter that silently rounds an account number is worse than one that
 * hands it back as a string.
 */
export function readCsvValue(
  field: string,
  reading: CsvValueReading,
): string | number | boolean | null {
  if (reading === 'text') return field;
  if (field === 'true') return true;
  if (field === 'false') return false;
  if (field === 'null') return null;

  if (jsonNumber.test(field)) {
    const value = Number(field);

    return String(value) === field ? value : field;
  }

  return field;
}

/**
 * The other delimiters that appear on a line, so a note can offer one.
 *
 * Only asked when a file parsed to a single column, which is what choosing the
 * wrong delimiter looks like from the inside.
 */
export function findOtherDelimiters(
  line: string,
  chosen: CsvDelimiter,
): readonly CsvDelimiterDetail[] {
  return csvDelimiterDetails.filter(
    (detail) => detail.id !== chosen && line.includes(detail.character),
  );
}

/**
 * A table read back into records.
 *
 * The header row names the keys and everything after it is a row. A row with
 * fewer fields than the header is filled in and said so; a row with more is
 * refused, because there is nowhere to put the extra values and dropping them
 * quietly is how a converter loses a column without anybody noticing.
 */
export function convertCsvToJson(
  input: string,
  delimiter: CsvDelimiter,
  reading: CsvValueReading,
): CsvConversionResult | undefined {
  // Excel writes a byte order mark, and left in place it becomes part of the
  // first column's name — a key that looks right and matches nothing.
  const text = input.startsWith('\uFEFF') ? input.slice(1) : input;

  if (text.trim() === '') return undefined;

  const notes: string[] = [];

  if (text !== input) {
    notes.push(
      'A byte order mark at the start was read past. A spreadsheet writes one; left in place it would have become part of the first column’s name.',
    );
  }

  const separator = getCsvDelimiter(delimiter).character;
  // Anything that is not whitespace lands in a field, and the check above has
  // already established that there is some, so there is always a header here.
  const [header, ...rows] = parseCsvRecords(text, separator);
  const columns = header.fields;
  const blank = columns.findIndex((name) => name === '');

  if (blank !== -1) {
    return {
      ok: false,
      message: `Column ${blank + 1} of the header row has no name, so its values have no key to go under. Name it, or remove the column.`,
    };
  }

  const duplicate = columns.find((name, index) => columns.indexOf(name) !== index);

  if (duplicate !== undefined) {
    return {
      ok: false,
      message: `The header names “${duplicate}” twice. An object cannot hold one key twice, so the second column’s values would silently replace the first’s. Rename one of them.`,
    };
  }

  if (columns.length === 1) {
    const others = findOtherDelimiters(header.fields[0], delimiter);

    if (others.length > 0) {
      notes.push(
        `The header came out as one column named “${columns[0]}”, and it contains ${describeNames(others.map((other) => other.label.toLowerCase()))}. If this file is not really one column wide, that is the delimiter to choose above.`,
      );
    }
  }

  if (columns.some((name) => name.trim() !== name)) {
    notes.push(
      'A column name has a space at one end, and it was kept: the key is written exactly as the header spells it, spaces included, rather than tidied into a key that would not match the file.',
    );
  }

  const long = rows.find((row) => row.fields.length > columns.length);

  if (long) {
    return {
      ok: false,
      message: `Line ${long.line} has ${long.fields.length} fields and the header has ${columns.length}, so ${long.fields.length - columns.length} of its values have no column to go under. Nothing was converted and nothing was dropped: it is usually a separator inside a value that was never quoted, or the wrong delimiter chosen above.`,
    };
  }

  const short = rows.filter((row) => row.fields.length < columns.length);

  if (short.length > 0) {
    notes.push(
      `${describeLines(short.map((row) => row.line))} ${short.length === 1 ? 'stops' : 'stop'} short of the header’s ${columns.length} columns. The fields off the end were written as empty text, so every record has the same keys.`,
    );
  }

  if (rows.length === 0) {
    notes.push('The header row is the only row here, so the result is an empty list.');
  }

  const output = JSON.stringify(
    rows.map((row) =>
      Object.fromEntries(
        columns.map((name, index) => [name, readCsvValue(row.fields[index] ?? '', reading)]),
      ),
    ),
    null,
    2,
  );

  return { ok: true, conversion: { output, columns, rowCount: rows.length, notes } };
}

/** `3 rows, 4 columns`, for a result heading that has to say how much. */
export function describeConversion(conversion: CsvConversion): string {
  const rows = `${conversion.rowCount} ${conversion.rowCount === 1 ? 'row' : 'rows'}`;
  const columns = `${conversion.columns.length} ${conversion.columns.length === 1 ? 'column' : 'columns'}`;

  return `${rows}, ${columns}`;
}
