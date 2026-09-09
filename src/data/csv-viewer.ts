import {
  csvDelimiterDetails,
  findOtherDelimiters,
  formatCsvRows,
  getCsvDelimiter,
  parseCsvRecords,
  type CsvDelimiter,
  type CsvDelimiterDetail,
} from './json-csv';

/**
 * A delimited file read as a table, and written back out tidied.
 *
 * The reader and the writer are the ones the JSON and CSV Converter already
 * uses — one RFC 4180 state machine on this site rather than two that can
 * disagree about what a quote means. What is different here is the answer to a
 * malformed file. A converter refuses a row with more fields than the header,
 * because there is no column to put the extra values in and dropping them
 * loses a field quietly. A viewer has somewhere to put them: on screen, in a
 * column with no name, beside the line they are on. Nothing here refuses a
 * document for its shape, because showing you the shape is the job.
 *
 * The separator is detected, which the converter deliberately does not do, and
 * the difference is what happens next: this page says which separator it read
 * the file with and why, and the control that changed it is the same control
 * you can change back. A guess that is stated and reversible is not the same
 * thing as a guess made quietly about your data.
 *
 * The table on screen is bounded and the document is not. A spreadsheet export
 * of a hundred thousand orders is exactly what somebody wants to look at, and
 * drawing a hundred thousand table rows is how a tab stops responding — so the
 * table is capped, says how much of the document it is showing, and the tidied
 * CSV underneath it is still all of it.
 */

/**
 * The largest document this page reads, as bytes of a file and as characters
 * of a paste.
 *
 * One number for both, and the byte is the conservative half: UTF-8 never
 * spends fewer than one byte on a character, so a file that passes the size
 * check cannot fail the length one.
 */
export const maximumCsvSize = 8 * 1024 * 1024;

/** How many rows the table draws, however many the document holds. */
export const csvTablePreviewRows = 200;

/** How many columns it draws, for the export that is wide rather than long. */
export const csvTablePreviewColumns = 50;

/**
 * How much of the document the separator is detected from.
 *
 * Enough to be sure of, and small enough to run on every keystroke. The prefix
 * can cut a record in half, which costs that record its place in the scoring —
 * and costs it for every candidate equally, since they all read the same
 * prefix.
 */
export const csvDetectionCharacters = 64 * 1024;

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/** What a picker and a dropped file can be recognised by. */
interface CsvFileDetails {
  readonly name: string;
  readonly type: string;
}

/**
 * Whether a file is a delimited document, by its name and reported type.
 *
 * The box takes any text at all, deliberately: a `.dat` export is still a
 * table, and refusing one on its extension would be refusing a file this can
 * read perfectly well. This narrower question is the one asked where a file
 * has to be recognised rather than accepted — the flow that starts from a CSV,
 * and the file dropped on the home page to find out what reads it — because
 * offering to open every file on a device as a table would be a worse answer
 * than offering nothing.
 */
export function isDelimitedTextFile(file: CsvFileDetails): boolean {
  return (
    file.type === 'text/csv' ||
    file.type === 'text/tab-separated-values' ||
    /\.(csv|tsv|tab)$/i.test(file.name)
  );
}

/** The reason a file was not read, or nothing, from what the picker knows. */
export function validateCsvFile(file: { readonly size: number }): string | undefined {
  if (file.size > maximumCsvSize) {
    return `That file is larger than the ${formatMegabytes(maximumCsvSize)} this page reads. The whole document is held in this tab to be shown as a table, so it has to fit in it.`;
  }

  return undefined;
}

/**
 * The reason a document is not a delimited text file, or nothing.
 *
 * A spreadsheet is what people actually try to open here, and an `.xlsx` is a
 * ZIP archive of XML rather than a table — so it is named rather than shown as
 * a screen of replacement characters. Anything else carrying a null byte is
 * binary of some kind, which is the same answer in a shorter sentence.
 */
export function getCsvTextProblem(text: string): string | undefined {
  if (text.length > maximumCsvSize) {
    return `That is more than the ${formatMegabytes(maximumCsvSize)} of text this page reads. The whole document is held in this tab to be shown as a table, so it has to fit in it.`;
  }

  if (text.startsWith('PK\u0003\u0004')) {
    return 'That is a ZIP archive rather than text, which is what an .xlsx and an .ods file are made of. A spreadsheet program has to export it: in Excel, Save As and choose CSV.';
  }

  if (text.includes('\0')) {
    return 'That file is not text — it holds null bytes, which a delimited document never does. Reading it here would show a screen of replacement characters rather than a table.';
  }

  return undefined;
}

/** What a separator scored on the document, before one of them is chosen. */
export interface CsvDelimiterScore {
  readonly delimiter: CsvDelimiter;
  /** Fields in the first record, which is the width it would give the table. */
  readonly columns: number;
  /** Records whose field count matches that width. */
  readonly consistentRecords: number;
  readonly records: number;
}

export interface CsvDelimiterDetection {
  readonly delimiter: CsvDelimiter;
  /** Whether it split anything, or is the fallback saying nothing did. */
  readonly split: boolean;
  readonly scores: readonly CsvDelimiterScore[];
}

function scoreCsvDelimiter(text: string, delimiter: CsvDelimiter): CsvDelimiterScore {
  const records = parseCsvRecords(text, getCsvDelimiter(delimiter).character);
  const columns = records[0]?.fields.length ?? 0;

  return {
    delimiter,
    columns,
    consistentRecords: records.filter((record) => record.fields.length === columns).length,
    records: records.length,
  };
}

/**
 * Which separator this document is written with.
 *
 * Every candidate reads the document, and the widest consistent reading wins:
 * more rows agreeing on a width beats fewer, and a wider table beats a
 * narrower one at the same agreement. A separator that splits nothing is not a
 * candidate at all, and when none of them splits anything the answer is the
 * comma with `split` false — a one-column document read as one column, said
 * out loud rather than presented as a finding.
 *
 * Ties go to the order the separators are offered in, which puts the comma
 * first. That is what settles a two-column file whose values happen to contain
 * a pipe: both readings are consistent, and the comma is the one CSV is named
 * after.
 */
export function detectCsvDelimiter(text: string): CsvDelimiterDetection {
  const prefix = text.slice(0, csvDetectionCharacters);
  const scores = csvDelimiterDetails.map((detail) => scoreCsvDelimiter(prefix, detail.id));

  const best = scores
    .filter((score) => score.columns > 1)
    .reduce<CsvDelimiterScore | undefined>((chosen, score) => {
      if (!chosen) return score;
      if (score.consistentRecords !== chosen.consistentRecords) {
        return score.consistentRecords > chosen.consistentRecords ? score : chosen;
      }

      return score.columns > chosen.columns ? score : chosen;
    }, undefined);

  return { delimiter: best?.delimiter ?? 'comma', split: best !== undefined, scores };
}

function describeDelimiterNames(details: readonly CsvDelimiterDetail[]): string {
  const names = details.map((detail) => detail.label.toLowerCase());

  if (names.length === 1) return `the ${names[0]}`;

  return `the ${names.slice(0, -1).join(', the ')} and the ${names.at(-1)}`;
}

/** The same list opening a sentence, since one of these notes does. */
function describeDelimiterNamesLeading(details: readonly CsvDelimiterDetail[]): string {
  const named = describeDelimiterNames(details);

  return `${named[0].toUpperCase()}${named.slice(1)}`;
}

/** What the page says about the separator it read the document with. */
export function describeCsvDelimiterDetection(detection: CsvDelimiterDetection): string {
  if (!detection.split) {
    return 'Nothing here is separated by a comma, semicolon, tab or pipe, so the document is read as a single column. Choose the separator below if it uses one of them somewhere further down.';
  }

  const chosen = getCsvDelimiter(detection.delimiter);
  const columns = detection.scores.find(
    (score) => score.delimiter === detection.delimiter,
  )?.columns;
  const idle = detection.scores.filter(
    (score) => score.delimiter !== detection.delimiter && score.columns <= 1,
  );
  const opening = `Read with ${chosen.label.toLowerCase()}s, which give ${columns} columns here.`;

  if (idle.length === detection.scores.length - 1) {
    return `${opening} ${describeDelimiterNamesLeading(
      idle.map((score) => getCsvDelimiter(score.delimiter)),
    )} split it into nothing at all. Change it below if that is wrong.`;
  }

  return `${opening} More than any of the others manage, which is the whole of why it was chosen. Change it below if that is wrong.`;
}

/** One column of the table, named by the header or by where it is. */
export interface CsvTableColumn {
  /** 1-based, and what an unnamed column is called. */
  readonly position: number;
  readonly label: string;
  /** False when the header row does not reach this far, or leaves it blank. */
  readonly named: boolean;
}

export type CsvRowShape = 'even' | 'short' | 'long';

/** One row of the table, and where in the document it came from. */
export interface CsvTableRow {
  /** 1-based among the data rows, which is not the document's line number. */
  readonly position: number;
  /** The 1-based line the record begins on. A quoted value can span several. */
  readonly line: number;
  /** Padded and truncated to the columns the table draws. */
  readonly cells: readonly string[];
  /** How its own field count compares with the width that was expected. */
  readonly shape: CsvRowShape;
  readonly fieldCount: number;
}

export interface CsvTable {
  readonly delimiter: CsvDelimiter;
  /** The columns drawn, which is at most `csvTablePreviewColumns` of them. */
  readonly columns: readonly CsvTableColumn[];
  readonly columnCount: number;
  readonly hiddenColumnCount: number;
  /** The rows drawn, which is at most `csvTablePreviewRows` of them. */
  readonly rows: readonly CsvTableRow[];
  readonly rowCount: number;
  readonly hiddenRowCount: number;
  /** The whole document, quoted on one rule and ended CRLF. */
  readonly formatted: string;
  readonly notes: readonly string[];
}

/** How many line numbers a note names before it starts counting instead. */
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

function countRows(count: number): string {
  return `${count.toLocaleString('en-GB')} ${count === 1 ? 'row' : 'rows'}`;
}

function countColumns(count: number): string {
  return `${count.toLocaleString('en-GB')} ${count === 1 ? 'column' : 'columns'}`;
}

/** `12 rows, 4 columns`, for a heading that has to say how much there is. */
export function describeCsvTable(table: CsvTable): string {
  return `${countRows(table.rowCount)}, ${countColumns(table.columnCount)}`;
}

/** What the tidied document is offered as when it came from a paste. */
export const csvViewerDownloadName = 'table.csv';

/**
 * What the tidied document is called.
 *
 * Named after the file it came from, because a downloads folder holding
 * `table.csv` beside the export it was made from is a folder nobody can read
 * later. A paste has no name of its own and gets the generic one.
 */
export function getFormattedCsvName(sourceName?: string): string {
  if (!sourceName || sourceName.trim() === '') return csvViewerDownloadName;

  const dot = sourceName.lastIndexOf('.');
  const stem = (dot > 0 ? sourceName.slice(0, dot) : sourceName).trim();

  return `${stem === '' ? 'table' : stem}-tidied.csv`;
}

function nameColumns(
  header: readonly string[] | undefined,
  columnCount: number,
): readonly CsvTableColumn[] {
  return Array.from({ length: columnCount }, (_unused, index) => {
    const name = header?.[index] ?? '';

    return {
      position: index + 1,
      label: name === '' ? `Column ${index + 1}` : name,
      named: name !== '',
    };
  });
}

function shapeRow(fieldCount: number, expected: number): CsvRowShape {
  if (fieldCount < expected) return 'short';
  if (fieldCount > expected) return 'long';

  return 'even';
}

/**
 * The document read as a table.
 *
 * An empty box is a question nobody has asked yet rather than a failure, so it
 * comes back as `undefined` — the same answer the converter gives, for the same
 * reason.
 *
 * The table is as wide as its widest record, not as wide as its header. That is
 * the difference between showing a document and converting one: a row with a
 * field too many is drawn in full, under a column with no name and beside the
 * line it is on, so an unquoted separator is something you can see rather than
 * something you are told about.
 */
export function readCsvTable(
  input: string,
  delimiter: CsvDelimiter,
  firstRowIsHeader: boolean,
): CsvTable | undefined {
  // Excel writes a byte order mark. Left in place it becomes part of the first
  // column's name — a heading that looks right and matches nothing.
  const text = input.startsWith('\uFEFF') ? input.slice(1) : input;

  if (text.trim() === '') return undefined;

  const notes: string[] = [];

  if (text !== input) {
    notes.push(
      'A byte order mark at the start was read past. A spreadsheet writes one; left in place it would have become part of the first column’s name.',
    );
  }

  const separator = getCsvDelimiter(delimiter).character;
  const records = parseCsvRecords(text, separator);
  const header = firstRowIsHeader ? records[0] : undefined;
  const body = firstRowIsHeader ? records.slice(1) : records;
  const columnCount = records.reduce((widest, record) => Math.max(widest, record.fields.length), 0);
  const columns = nameColumns(header?.fields, columnCount);
  const drawn = columns.slice(0, csvTablePreviewColumns);
  /**
   * The width a row is measured against. The header names it when there is
   * one; without a header there is nothing to disagree with but the widest row
   * in the document, so that is what a short row is short of.
   */
  const expected = header ? header.fields.length : columnCount;

  const rows: readonly CsvTableRow[] = body
    .slice(0, csvTablePreviewRows)
    .map((record, index) => ({
      position: index + 1,
      line: record.line,
      cells: drawn.map((_column, cell) => record.fields[cell] ?? ''),
      shape: shapeRow(record.fields.length, expected),
      fieldCount: record.fields.length,
    }));

  if (header) {
    const blank = header.fields
      .map((name, index) => ({ name, position: index + 1 }))
      .filter((column) => column.name === '');

    if (blank.length > 0) {
      notes.push(
        `${blank.length === 1 ? 'Column' : 'Columns'} ${joinNumbers(blank.map((column) => column.position))} of the header row ${blank.length === 1 ? 'has' : 'have'} no name, so ${blank.length === 1 ? 'it is' : 'they are'} shown by position instead. The values underneath are still there; it is only the heading that is missing.`,
      );
    }

    const duplicates = [
      ...new Set(
        header.fields.filter((name, index) => name !== '' && header.fields.indexOf(name) !== index),
      ),
    ];

    if (duplicates.length > 0) {
      notes.push(
        `The header names ${duplicates.map((name) => `“${name}”`).join(', ')} more than once. Every column is shown as it is, because this reads a document rather than repairing one — but anything that keys a row by its column name will keep one of them and lose the rest.`,
      );
    }

    const long = body.filter((record) => record.fields.length > expected);

    if (long.length > 0) {
      notes.push(
        `${describeLines(long.map((record) => record.line))} ${long.length === 1 ? 'has' : 'have'} more fields than the header names, so the table is wider than its headings and the extra values sit in columns with none. Nothing was dropped. It is usually a separator inside a value that was never quoted.`,
      );
    }
  }

  const short = body.filter((record) => record.fields.length < expected);

  if (short.length > 0) {
    notes.push(
      `${describeLines(short.map((record) => record.line))} ${short.length === 1 ? 'stops' : 'stop'} short of the ${countColumns(expected)} ${header ? 'the header names' : 'the widest row has'}. The cells off the end are shown empty, and the tidied CSV writes them as empty text so every row is the same width.`,
    );
  }

  if (columnCount === 1) {
    const others = findOtherDelimiters(records[0].fields[0], delimiter);

    if (others.length > 0) {
      notes.push(
        `Everything is in one column, and the first line contains ${describeDelimiterNames(others)}. If this document is not really one column wide, that is the separator to choose.`,
      );
    }
  }

  if (header && body.length === 0) {
    notes.push('The header row is the only row here, so there is nothing under the headings yet.');
  }

  const hiddenRowCount = body.length - rows.length;
  const hiddenColumnCount = columnCount - drawn.length;

  if (hiddenRowCount > 0 || hiddenColumnCount > 0) {
    const kept = [
      hiddenRowCount > 0 ? `the first ${countRows(rows.length)} of ${countRows(body.length)}` : '',
      hiddenColumnCount > 0
        ? `the first ${countColumns(drawn.length)} of ${countColumns(columnCount)}`
        : '',
    ].filter((part) => part !== '');

    notes.push(
      `The table shows ${kept.join(' and ')}. Drawing every cell of a document this size is how a tab stops responding; the tidied CSV below it is all of it.`,
    );
  }

  const formatted = formatCsvRows(
    records.map((record) =>
      Array.from({ length: columnCount }, (_unused, index) => record.fields[index] ?? ''),
    ),
    separator,
  );

  if (formatted !== text) {
    notes.push(
      'The tidied CSV is not what you opened character for character. A value is quoted when, and only when, it holds the separator, a double quote or a line break; every row is written the same width; and every line ends CRLF, the ending RFC 4180 names and the one a spreadsheet on Windows still wants.',
    );
  }

  return {
    delimiter,
    columns: drawn,
    columnCount,
    hiddenColumnCount,
    rows,
    rowCount: body.length,
    hiddenRowCount,
    formatted,
    notes,
  };
}
