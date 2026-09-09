import { describe, expect, it } from 'vitest';

import {
  csvDetectionCharacters,
  csvTablePreviewColumns,
  csvTablePreviewRows,
  csvViewerDownloadName,
  describeCsvDelimiterDetection,
  describeCsvTable,
  detectCsvDelimiter,
  getCsvTextProblem,
  getFormattedCsvName,
  isDelimitedTextFile,
  maximumCsvSize,
  readCsvTable,
  validateCsvFile,
  type CsvTable,
} from '../../src/data/csv-viewer';
import { csvLineEnding, parseCsvRecords } from '../../src/data/json-csv';

/** The table, or a failed assertion saying nothing was read at all. */
function expectTable(table: CsvTable | undefined): CsvTable {
  expect(table, 'nothing was read at all').toBeDefined();

  return table!;
}

/** Every note as one string, for asking whether a thing was mentioned. */
function notes(table: CsvTable): string {
  return table.notes.join('\n');
}

describe('what it refuses to read', () => {
  it('refuses a file larger than it can hold, and takes one exactly at the limit', () => {
    expect(validateCsvFile({ size: maximumCsvSize })).toBeUndefined();

    const refusal = validateCsvFile({ size: maximumCsvSize + 1 });

    expect(refusal).toContain('8 MB');
    expect(refusal).toContain('this tab');
  });

  it('names a spreadsheet rather than showing its archive as a table', () => {
    const problem = getCsvTextProblem('PK\u0003\u0004\u0014\u0000');

    expect(problem).toContain('.xlsx');
    expect(problem).toContain('CSV');
  });

  it('refuses anything else holding a null byte, because it is not text', () => {
    expect(getCsvTextProblem('name,born\nAda\u00001815')).toContain('null bytes');
  });

  it('refuses more pasted text than it reads, in the same terms as a file', () => {
    expect(getCsvTextProblem('a'.repeat(maximumCsvSize + 1))).toContain('8 MB');
  });

  it('has nothing to say about a document it can read', () => {
    expect(getCsvTextProblem('name,born\nAda,1815')).toBeUndefined();
    // A header whose first column is called PKID is not a ZIP archive.
    expect(getCsvTextProblem('PKID,name\n1,Ada')).toBeUndefined();
  });
});

describe('recognising a delimited file', () => {
  const file = (name: string, type: string) => ({ name, type });

  it('knows a table by its extension or by the type the browser reports', () => {
    expect(isDelimitedTextFile(file('orders.csv', 'text/csv'))).toBe(true);
    expect(isDelimitedTextFile(file('ORDERS.CSV', ''))).toBe(true);
    expect(isDelimitedTextFile(file('range.tsv', ''))).toBe(true);
    expect(isDelimitedTextFile(file('range.tab', ''))).toBe(true);
    expect(isDelimitedTextFile(file('export', 'text/tab-separated-values'))).toBe(true);
  });

  it('does not claim every text file is a table, which is what the box is for', () => {
    expect(isDelimitedTextFile(file('notes.txt', 'text/plain'))).toBe(false);
    expect(isDelimitedTextFile(file('people.json', 'application/json'))).toBe(false);
    expect(isDelimitedTextFile(file('report.pdf', 'application/pdf'))).toBe(false);
  });
});

describe('detecting the separator', () => {
  it('reads a comma file as commas', () => {
    const detection = detectCsvDelimiter('name,born\nAda,1815\nGrace,1906');

    expect(detection.delimiter).toBe('comma');
    expect(detection.split).toBe(true);
  });

  it('reads a European export as semicolons rather than as one column', () => {
    const detection = detectCsvDelimiter('name;price\nAda;1,50\nGrace;2,75');

    expect(detection.delimiter).toBe('semicolon');
    expect(detection.scores.find((score) => score.delimiter === 'comma')?.columns).toBe(1);
  });

  it('reads a tab-separated paste and a piped dump as themselves', () => {
    expect(detectCsvDelimiter('name\tborn\nAda\t1815').delimiter).toBe('tab');
    expect(detectCsvDelimiter('name|born\nAda|1815').delimiter).toBe('pipe');
  });

  it('is not fooled by a separator that only ever appears inside quotes', () => {
    const detection = detectCsvDelimiter(
      ['name;note', '"Lovelace, Ada";"one, two, three"', '"Hopper, Grace";"four, five"'].join('\n'),
    );

    expect(detection.delimiter).toBe('semicolon');
  });

  it('prefers the reading more rows agree with', () => {
    // Every row has three semicolon fields; the comma count is all over the
    // place, which is what a separator that is really punctuation looks like.
    const detection = detectCsvDelimiter(
      ['a;b;c', 'one;two,three;four', 'five,six,seven;eight;nine'].join('\n'),
    );

    expect(detection.delimiter).toBe('semicolon');
    expect(detection.scores.find((score) => score.delimiter === 'semicolon')?.consistentRecords).toBe(3);
  });

  it('falls back to the comma, and says nothing split it, when nothing did', () => {
    const detection = detectCsvDelimiter('one line of prose\nand another one');

    expect(detection.delimiter).toBe('comma');
    expect(detection.split).toBe(false);
    expect(describeCsvDelimiterDetection(detection)).toContain('single column');
  });

  it('gives a tie to the comma, which is the one CSV is named after', () => {
    const detection = detectCsvDelimiter('a,b|c\nd,e|f');

    expect(detection.delimiter).toBe('comma');
  });

  it('says how many columns it got, and names the separators that got none', () => {
    const sentence = describeCsvDelimiterDetection(detectCsvDelimiter('name;born\nAda;1815'));

    expect(sentence).toContain('semicolons');
    expect(sentence).toContain('2 columns');
    expect(sentence).toContain('comma');
    expect(sentence).toContain('Change it below');
  });

  it('opens the sentence with a capital when the idle separators start it', () => {
    const sentence = describeCsvDelimiterDetection(detectCsvDelimiter('name\tborn\nAda\t1815'));

    expect(sentence).toContain('. The comma, the semicolon and the pipe split it');
  });

  it('reads only the prefix, so a long document costs the same as a short one', () => {
    const wide = `${'a,b,c\n'.repeat(200)}${'x'.repeat(csvDetectionCharacters)}\n`;

    expect(detectCsvDelimiter(wide).delimiter).toBe('comma');
  });
});

describe('reading a document as a table', () => {
  const document = ['name,born,note', 'Ada,1815,first', 'Grace,1906,second'].join('\n');

  it('says nothing at all about an empty box', () => {
    expect(readCsvTable('', 'comma', true)).toBeUndefined();
    expect(readCsvTable('   \n  ', 'comma', true)).toBeUndefined();
  });

  it('names the columns from the header row and counts what is under them', () => {
    const table = expectTable(readCsvTable(document, 'comma', true));

    expect(table.columns.map((column) => column.label)).toEqual(['name', 'born', 'note']);
    expect(table.columns.every((column) => column.named)).toBe(true);
    expect(table.rowCount).toBe(2);
    expect(table.columnCount).toBe(3);
    expect(table.rows.map((row) => row.cells)).toEqual([
      ['Ada', '1815', 'first'],
      ['Grace', '1906', 'second'],
    ]);
    expect(describeCsvTable(table)).toBe('2 rows, 3 columns');
  });

  it('numbers the columns instead when the first row is data', () => {
    const table = expectTable(readCsvTable(document, 'comma', false));

    expect(table.columns.map((column) => column.label)).toEqual([
      'Column 1',
      'Column 2',
      'Column 3',
    ]);
    expect(table.columns.some((column) => column.named)).toBe(false);
    expect(table.rowCount).toBe(3);
    expect(table.rows[0].cells).toEqual(['name', 'born', 'note']);
  });

  it('gives every row the line it starts on, counting a value that spans several', () => {
    const table = expectTable(
      readCsvTable(['who,note', '"two\nlines",first', 'after,second'].join('\n'), 'comma', true),
    );

    expect(table.rows.map((row) => row.line)).toEqual([2, 4]);
    expect(table.rows[0].cells).toEqual(['two\nlines', 'first']);
  });

  it('reads a quoted separator as one value rather than as two columns', () => {
    const table = expectTable(
      readCsvTable('name,born\n"Lovelace, Ada",1815', 'comma', true),
    );

    expect(table.columnCount).toBe(2);
    expect(table.rows[0].cells).toEqual(['Lovelace, Ada', '1815']);
  });

  it('reads the same document as one column with the wrong separator, and says which to try', () => {
    const table = expectTable(readCsvTable('name;born\nAda;1815', 'comma', true));

    expect(table.columnCount).toBe(1);
    expect(notes(table)).toContain('semicolon');
  });

  it('shows a row with a field too many rather than refusing the document', () => {
    const table = expectTable(
      readCsvTable(['name,born', 'Ada,1815', 'Grace,1906,extra'].join('\n'), 'comma', true),
    );

    expect(table.columnCount).toBe(3);
    expect(table.columns[2]).toMatchObject({ label: 'Column 3', named: false });
    expect(table.rows[1].shape).toBe('long');
    expect(table.rows[1].cells).toEqual(['Grace', '1906', 'extra']);
    expect(notes(table)).toContain('Line 3');
    expect(notes(table)).toContain('Nothing was dropped');
  });

  it('fills a row that stops short, and names the line it is on', () => {
    const table = expectTable(
      readCsvTable(['name,born,note', 'Ada,1815', 'Grace,1906,second'].join('\n'), 'comma', true),
    );

    expect(table.rows[0].shape).toBe('short');
    expect(table.rows[0].cells).toEqual(['Ada', '1815', '']);
    expect(table.rows[1].shape).toBe('even');
    expect(notes(table)).toContain('Line 2');
    expect(notes(table)).toContain('3 columns the header names');
  });

  it('measures a headerless document against its widest row instead', () => {
    const table = expectTable(readCsvTable('Ada,1815\nGrace,1906,second', 'comma', false));

    expect(table.rows.map((row) => row.shape)).toEqual(['short', 'even']);
    expect(notes(table)).toContain('the widest row has');
  });

  it('shows a duplicated column name as it is, and says what will lose it', () => {
    const table = expectTable(readCsvTable('id,name,id\n1,Ada,2', 'comma', true));

    expect(table.columns.map((column) => column.label)).toEqual(['id', 'name', 'id']);
    expect(notes(table)).toContain('“id”');
    expect(notes(table)).toContain('keys a row by its column name');
  });

  it('shows an unnamed heading by position rather than leaving the column blank', () => {
    const table = expectTable(readCsvTable('name,,note\nAda,x,first', 'comma', true));

    expect(table.columns[1]).toMatchObject({ label: 'Column 2', named: false });
    expect(notes(table)).toContain('Column 2 of the header row has no name');
    expect(table.rows[0].cells[1]).toBe('x');
  });

  it('reads past a byte order mark and says it did', () => {
    const table = expectTable(readCsvTable('\uFEFFname,born\nAda,1815', 'comma', true));

    expect(table.columns[0].label).toBe('name');
    expect(notes(table)).toContain('byte order mark');
  });

  it('says so when the header row is the only row', () => {
    const table = expectTable(readCsvTable('name,born', 'comma', true));

    expect(table.rowCount).toBe(0);
    expect(table.rows).toHaveLength(0);
    expect(notes(table)).toContain('nothing under the headings');
  });
});

describe('the bound on what it draws', () => {
  it('draws at most its own number of rows, and counts the rest', () => {
    const rows = Array.from({ length: csvTablePreviewRows + 50 }, (_unused, index) => `row-${index}`);
    const table = expectTable(readCsvTable(['name', ...rows].join('\n'), 'comma', true));

    expect(table.rowCount).toBe(csvTablePreviewRows + 50);
    expect(table.rows).toHaveLength(csvTablePreviewRows);
    expect(table.hiddenRowCount).toBe(50);
    expect(notes(table)).toContain('the first 200 rows of 250 rows');
    // What is not drawn is still written out, which is the whole point of
    // saying the table is the part that is bounded.
    expect(parseCsvRecords(table.formatted, ',')).toHaveLength(csvTablePreviewRows + 51);
  });

  it('draws at most its own number of columns, and counts the rest', () => {
    const header = Array.from(
      { length: csvTablePreviewColumns + 10 },
      (_unused, index) => `column-${index}`,
    );
    const table = expectTable(readCsvTable(header.join(','), 'comma', true));

    expect(table.columnCount).toBe(csvTablePreviewColumns + 10);
    expect(table.columns).toHaveLength(csvTablePreviewColumns);
    expect(table.hiddenColumnCount).toBe(10);
    expect(notes(table)).toContain('the first 50 columns of 60 columns');
  });

  it('cuts every drawn row to the drawn columns, so no row is wider than its table', () => {
    const wide = Array.from({ length: csvTablePreviewColumns + 4 }, (_unused, index) => index);
    const table = expectTable(
      readCsvTable([wide.join(','), wide.join(',')].join('\n'), 'comma', true),
    );

    expect(table.rows[0].cells).toHaveLength(csvTablePreviewColumns);
    expect(table.rows[0].fieldCount).toBe(csvTablePreviewColumns + 4);
  });
});

describe('the tidied document it hands back', () => {
  it('quotes what has to be quoted and nothing else, and ends every line CRLF', () => {
    const table = expectTable(
      readCsvTable(['name,note', 'Ada,"plain"', '"Grace","said ""no"""'].join('\n'), 'comma', true),
    );

    expect(table.formatted).toBe(
      ['name,note', 'Ada,plain', 'Grace,"said ""no"""'].join(csvLineEnding),
    );
  });

  it('writes every row the same width, so what comes out is a rectangle', () => {
    const table = expectTable(
      readCsvTable(['name,born,note', 'Ada,1815', 'Grace,1906,second,extra'].join('\n'), 'comma', true),
    );

    expect(table.formatted.split(csvLineEnding)).toEqual([
      'name,born,note,',
      'Ada,1815,,',
      'Grace,1906,second,extra',
    ]);
  });

  it('reads its own output back as the same table', () => {
    const table = expectTable(
      readCsvTable(['name,note', '"Lovelace, Ada","two\nlines"'].join('\n'), 'comma', true),
    );
    const again = expectTable(readCsvTable(table.formatted, 'comma', true));

    expect(again.columns.map((column) => column.label)).toEqual(['name', 'note']);
    expect(again.rows[0].cells).toEqual(['Lovelace, Ada', 'two\nlines']);
    expect(again.formatted).toBe(table.formatted);
  });

  it('keeps the separator the document was read with', () => {
    const table = expectTable(readCsvTable('name;born\nAda;1815', 'semicolon', true));

    expect(table.formatted).toBe(['name;born', 'Ada;1815'].join(csvLineEnding));
  });

  it('says the tidied document is not the one you opened, when it is not', () => {
    expect(notes(expectTable(readCsvTable('name,born\nAda,1815', 'comma', true)))).toContain(
      'character for character',
    );
  });

  it('says nothing of the kind when the document was already written this way', () => {
    const tidy = ['name,born', 'Ada,1815'].join(csvLineEnding);

    expect(notes(expectTable(readCsvTable(tidy, 'comma', true)))).toBe('');
  });
});

describe('what the download is called', () => {
  it('names the tidied file after the one it came from', () => {
    expect(getFormattedCsvName('orders-2026.csv')).toBe('orders-2026-tidied.csv');
    expect(getFormattedCsvName('export.txt')).toBe('export-tidied.csv');
    expect(getFormattedCsvName('no-extension')).toBe('no-extension-tidied.csv');
  });

  it('falls back to a generic name for a paste, which has none', () => {
    expect(getFormattedCsvName()).toBe(csvViewerDownloadName);
    expect(getFormattedCsvName('   ')).toBe(csvViewerDownloadName);
    expect(csvViewerDownloadName.endsWith('.csv')).toBe(true);
  });
});
