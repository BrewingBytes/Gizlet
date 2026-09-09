import { describe, expect, it } from 'vitest';

import {
  convertCsvToJson,
  convertJsonToCsv,
  csvDelimiterDetails,
  csvDelimiters,
  csvDownloadName,
  csvLineEnding,
  csvValueReadingDetails,
  csvValueReadings,
  defaultCsvDelimiter,
  defaultCsvValueReading,
  describeConversion,
  findOtherDelimiters,
  formatCsvField,
  formatCsvRows,
  getConvertedRecordsName,
  getCsvDelimiter,
  getCsvValueReading,
  isCsvDelimiter,
  isCsvValueReading,
  jsonDownloadName,
  parseCsvRecords,
  readCsvValue,
  type CsvConversion,
  type CsvConversionResult,
} from '../../src/data/json-csv';

/** The conversion, or a failed assertion naming the message that came back. */
function expectOk(result: CsvConversionResult | undefined): CsvConversion {
  expect(result, 'nothing was converted at all').toBeDefined();
  expect(result!.ok ? undefined : result!.message).toBeUndefined();

  return (result as { readonly conversion: CsvConversion }).conversion;
}

function expectFailure(result: CsvConversionResult | undefined): string {
  expect(result, 'nothing was converted at all').toBeDefined();
  expect(result!.ok).toBe(false);

  return (result as { readonly message: string }).message;
}

describe('what a converted document is called', () => {
  it('keeps the name of the document it was made from', () => {
    expect(getConvertedRecordsName('orders-2026.csv', 'json')).toBe('orders-2026.json');
    expect(getConvertedRecordsName('people.json', 'csv')).toBe('people.csv');
    expect(getConvertedRecordsName('export', 'csv')).toBe('export.csv');
  });

  it('falls back to the generic names for a paste, which has none', () => {
    expect(getConvertedRecordsName(undefined, 'csv')).toBe(csvDownloadName);
    expect(getConvertedRecordsName('', 'json')).toBe(jsonDownloadName);
    expect(getConvertedRecordsName('   ', 'json')).toBe(jsonDownloadName);
  });
});

describe('the delimiters and the value readings', () => {
  it('describes every delimiter it offers, once each', () => {
    expect(csvDelimiterDetails.map((detail) => detail.id)).toEqual([...csvDelimiters]);
    expect(new Set(csvDelimiterDetails.map((detail) => detail.character))).toHaveLength(
      csvDelimiters.length,
    );

    for (const detail of csvDelimiterDetails) {
      expect(detail.character, detail.id).toHaveLength(1);
      expect(getCsvDelimiter(detail.id)).toBe(detail);
    }
  });

  it('describes every value reading it offers, once each', () => {
    expect(csvValueReadingDetails.map((detail) => detail.id)).toEqual([...csvValueReadings]);

    for (const detail of csvValueReadingDetails) {
      expect(getCsvValueReading(detail.id)).toBe(detail);
    }
  });

  it('defaults to the comma, and to the reading that loses nothing', () => {
    expect(defaultCsvDelimiter).toBe('comma');
    expect(defaultCsvValueReading).toBe('text');
  });

  it('recognises its own ids and refuses anything else', () => {
    expect(isCsvDelimiter('semicolon')).toBe(true);
    expect(isCsvDelimiter('colon')).toBe(false);
    expect(isCsvValueReading('typed')).toBe(true);
    expect(isCsvValueReading('guess')).toBe(false);
    expect(() => getCsvDelimiter('colon' as never)).toThrow(/Missing CSV delimiter/);
    expect(() => getCsvValueReading('guess' as never)).toThrow(/Missing CSV value reading/);
  });

  it('offers the other delimiters a line actually contains', () => {
    expect(findOtherDelimiters('name;age|city', 'comma').map((detail) => detail.id)).toEqual([
      'semicolon',
      'pipe',
    ]);
    expect(findOtherDelimiters('name;age', 'semicolon')).toEqual([]);
  });
});

describe('formatCsvField', () => {
  it('leaves a plain value bare', () => {
    expect(formatCsvField('Ada', ',')).toBe('Ada');
    expect(formatCsvField('', ',')).toBe('');
  });

  it('quotes a value holding the delimiter, and only that delimiter', () => {
    expect(formatCsvField('Lovelace, Ada', ',')).toBe('"Lovelace, Ada"');
    expect(formatCsvField('Lovelace, Ada', ';')).toBe('Lovelace, Ada');
    expect(formatCsvField('a;b', ';')).toBe('"a;b"');
    expect(formatCsvField('a\tb', '\t')).toBe('"a\tb"');
  });

  it('doubles a quote inside a value, and quotes the value around it', () => {
    expect(formatCsvField('she said "no"', ',')).toBe('"she said ""no"""');
    expect(formatCsvField('"', ',')).toBe('""""');
  });

  it('quotes a value holding a line break, either kind', () => {
    expect(formatCsvField('one\ntwo', ',')).toBe('"one\ntwo"');
    expect(formatCsvField('one\r\ntwo', ',')).toBe('"one\r\ntwo"');
  });

  it('quotes a value padded with spaces, so the padding survives the trip', () => {
    expect(formatCsvField(' yes', ',')).toBe('" yes"');
    expect(formatCsvField('yes ', ',')).toBe('"yes "');
    expect(formatCsvField('y e s', ',')).toBe('y e s');
  });

  it('ends a record the way RFC 4180 says', () => {
    expect(formatCsvRows([['a', 'b'], ['1', '2']], ',')).toBe(`a,b${csvLineEnding}1,2`);
  });

  it('writes a lone empty field as a quoted one, so the row is not an empty line', () => {
    expect(formatCsvRows([['a'], ['']], ',')).toBe(`a${csvLineEnding}""`);
    // A wider record already says how many fields it has without any help.
    expect(formatCsvRows([['a', 'b'], ['', '']], ',')).toBe(`a,b${csvLineEnding},`);
  });
});

describe('parseCsvRecords', () => {
  it('reads plain rows and remembers where each began', () => {
    expect(parseCsvRecords('a,b\n1,2\n3,4', ',')).toEqual([
      { fields: ['a', 'b'], line: 1 },
      { fields: ['1', '2'], line: 2 },
      { fields: ['3', '4'], line: 3 },
    ]);
  });

  it('accepts all three line endings, and a trailing one', () => {
    const expected = [
      { fields: ['a'], line: 1 },
      { fields: ['b'], line: 2 },
    ];

    expect(parseCsvRecords('a\nb', ',')).toEqual(expected);
    expect(parseCsvRecords('a\r\nb', ',')).toEqual(expected);
    expect(parseCsvRecords('a\rb', ',')).toEqual(expected);
    expect(parseCsvRecords('a\r\nb\r\n', ',')).toEqual(expected);
  });

  it('keeps a delimiter, a quote and a line break inside a quoted value', () => {
    expect(parseCsvRecords('"Lovelace, Ada",1', ',')).toEqual([
      { fields: ['Lovelace, Ada', '1'], line: 1 },
    ]);
    expect(parseCsvRecords('"she said ""no""",1', ',')).toEqual([
      { fields: ['she said "no"', '1'], line: 1 },
    ]);
    expect(parseCsvRecords('"one\ntwo",1', ',')).toEqual([
      { fields: ['one\ntwo', '1'], line: 1 },
    ]);
  });

  it('counts the lines a quoted value spans, so a later error names the right one', () => {
    expect(parseCsvRecords('a,b\n"one\ntwo",2\nx,y', ',')).toEqual([
      { fields: ['a', 'b'], line: 1 },
      { fields: ['one\ntwo', '2'], line: 2 },
      { fields: ['x', 'y'], line: 4 },
    ]);
  });

  it('treats a quote inside an already-started field as a character', () => {
    expect(parseCsvRecords('a"b,c', ',')).toEqual([{ fields: ['a"b', 'c'], line: 1 }]);
  });

  it('skips a wholly blank line but keeps a line of empty fields', () => {
    expect(parseCsvRecords('a,b\n\n1,2', ',')).toEqual([
      { fields: ['a', 'b'], line: 1 },
      { fields: ['1', '2'], line: 3 },
    ]);
    expect(parseCsvRecords(',', ',')).toEqual([{ fields: ['', ''], line: 1 }]);
    expect(parseCsvRecords('""', ',')).toEqual([{ fields: [''], line: 1 }]);
  });

  it('reads nothing out of nothing', () => {
    expect(parseCsvRecords('', ',')).toEqual([]);
    expect(parseCsvRecords('\n\n', ',')).toEqual([]);
  });
});

describe('convertJsonToCsv', () => {
  it('asks nothing of an empty box', () => {
    expect(convertJsonToCsv('', 'comma')).toBeUndefined();
    expect(convertJsonToCsv('   \n ', 'comma')).toBeUndefined();
  });

  it('writes a header row and one row per record', () => {
    const conversion = expectOk(
      convertJsonToCsv('[{"name":"Ada","born":1815},{"name":"Grace","born":1906}]', 'comma'),
    );

    expect(conversion.output).toBe(
      ['name,born', 'Ada,1815', 'Grace,1906'].join(csvLineEnding),
    );
    expect(conversion.columns).toEqual(['name', 'born']);
    expect(conversion.rowCount).toBe(2);
    expect(conversion.notes).toEqual([]);
  });

  it('orders columns by where each key first appears, and says so with the same input twice', () => {
    const input = '[{"b":1,"a":2},{"c":3,"a":4}]';
    const first = expectOk(convertJsonToCsv(input, 'comma'));

    expect(first.columns).toEqual(['b', 'a', 'c']);
    expect(expectOk(convertJsonToCsv(input, 'comma')).output).toBe(first.output);
  });

  it('writes each delimiter the visitor chose', () => {
    for (const detail of csvDelimiterDetails) {
      const conversion = expectOk(convertJsonToCsv('[{"a":1,"b":2}]', detail.id));

      expect(conversion.output, detail.id).toBe(
        `a${detail.character}b${csvLineEnding}1${detail.character}2`,
      );
    }
  });

  it('quotes a value that would otherwise break the row', () => {
    const conversion = expectOk(
      convertJsonToCsv('[{"who":"Lovelace, Ada","said":"she said \\"no\\"","note":"one\\ntwo"}]', 'comma'),
    );

    expect(conversion.output.split(csvLineEnding)[1]).toBe(
      '"Lovelace, Ada","she said ""no""","one\ntwo"',
    );
  });

  it('writes true, false and a number as themselves', () => {
    const conversion = expectOk(convertJsonToCsv('[{"a":true,"b":false,"c":1.5,"d":-0.25}]', 'comma'));

    expect(conversion.output.split(csvLineEnding)[1]).toBe('true,false,1.5,-0.25');
  });

  it('fills in a key a row does not carry, and names the rows that were short', () => {
    const conversion = expectOk(convertJsonToCsv('[{"a":1,"b":2},{"a":3}]', 'comma'));

    expect(conversion.output).toBe(['a,b', '1,2', '3,'].join(csvLineEnding));
    expect(conversion.notes).toHaveLength(1);
    expect(conversion.notes[0]).toContain('Item 2');
    expect(conversion.notes[0]).toContain('“b”');
  });

  it('writes a null as an empty cell and warns that it will not come back', () => {
    const conversion = expectOk(convertJsonToCsv('[{"a":null,"b":1}]', 'comma'));

    expect(conversion.output).toBe(['a,b', ',1'].join(csvLineEnding));
    expect(conversion.notes.join(' ')).toContain('does not return');
  });

  it('reports invalid JSON with its location, and changes nothing', () => {
    expect(expectFailure(convertJsonToCsv('[{"a":1,}]', 'comma'))).toMatch(/^Invalid JSON/);
  });

  it('refuses a top level that is not a list of rows, and says what to do', () => {
    expect(expectFailure(convertJsonToCsv('{"name":"Ada"}', 'comma'))).toContain('an object');
    expect(expectFailure(convertJsonToCsv('"Ada"', 'comma'))).toContain('a string');
    expect(expectFailure(convertJsonToCsv('null', 'comma'))).toContain('null');
    expect(expectFailure(convertJsonToCsv('{"name":"Ada"}', 'comma'))).toContain('square brackets');
  });

  it('refuses an empty array, which has no columns to write', () => {
    expect(expectFailure(convertJsonToCsv('[]', 'comma'))).toContain('empty');
    expect(expectFailure(convertJsonToCsv('[{},{}]', 'comma'))).toContain('nothing to make a column');
  });

  it('refuses an item that is not an object, and names which one', () => {
    expect(expectFailure(convertJsonToCsv('[{"a":1},"Ada"]', 'comma'))).toContain('Item 2');
    expect(expectFailure(convertJsonToCsv('[[1,2]]', 'comma'))).toContain('Item 1');
  });

  it('refuses nested JSON by name rather than flattening it', () => {
    const object = expectFailure(convertJsonToCsv('[{"a":1,"b":{"c":2}}]', 'comma'));

    expect(object).toContain('Item 1');
    expect(object).toContain('“b”');
    expect(object).toContain('an object');
    expect(expectFailure(convertJsonToCsv('[{"a":[1,2]}]', 'comma'))).toContain('an array');
  });
});

describe('convertCsvToJson', () => {
  it('asks nothing of an empty box', () => {
    expect(convertCsvToJson('', 'comma', 'text')).toBeUndefined();
    expect(convertCsvToJson(' \n ', 'comma', 'text')).toBeUndefined();
  });

  it('maps the header row onto every row under it', () => {
    const conversion = expectOk(convertCsvToJson('name,born\nAda,1815\nGrace,1906', 'comma', 'text'));

    expect(JSON.parse(conversion.output)).toEqual([
      { name: 'Ada', born: '1815' },
      { name: 'Grace', born: '1906' },
    ]);
    expect(conversion.columns).toEqual(['name', 'born']);
    expect(conversion.rowCount).toBe(2);
    expect(conversion.notes).toEqual([]);
  });

  it('reads a quoted comma, a doubled quote and a line break as one value each', () => {
    const conversion = expectOk(
      convertCsvToJson('who,note\n"Lovelace, Ada","she said ""no"""\n"two\nlines",x', 'comma', 'text'),
    );

    expect(JSON.parse(conversion.output)).toEqual([
      { who: 'Lovelace, Ada', note: 'she said "no"' },
      { who: 'two\nlines', note: 'x' },
    ]);
  });

  it('reads each delimiter the visitor chose', () => {
    for (const detail of csvDelimiterDetails) {
      const text = `a${detail.character}b\n1${detail.character}2`;

      expect(JSON.parse(expectOk(convertCsvToJson(text, detail.id, 'text')).output), detail.id).toEqual([
        { a: '1', b: '2' },
      ]);
    }
  });

  it('leaves every cell a string when nothing is being interpreted', () => {
    const conversion = expectOk(convertCsvToJson('a,b,c,d\n007,true,1.5,', 'comma', 'text'));

    expect(JSON.parse(conversion.output)).toEqual([{ a: '007', b: 'true', c: '1.5', d: '' }]);
  });

  it('types a cell only when writing it back gives the same characters', () => {
    const conversion = expectOk(
      convertCsvToJson(
        'a,b,c,d,e,f,g\n1.5,true,false,null,007,1e3,12345678901234567890',
        'comma',
        'typed',
      ),
    );

    expect(JSON.parse(conversion.output)).toEqual([
      { a: 1.5, b: true, c: false, d: null, e: '007', f: '1e3', g: '12345678901234567890' },
    ]);
  });

  it('keeps an empty cell an empty string in both readings', () => {
    for (const reading of csvValueReadings) {
      expect(
        JSON.parse(expectOk(convertCsvToJson('a,b\n,1', 'comma', reading)).output),
        reading,
      ).toEqual([{ a: '', b: reading === 'typed' ? 1 : '1' }]);
    }
  });

  it('reads past a byte order mark and says it did', () => {
    const conversion = expectOk(convertCsvToJson('﻿name\nAda', 'comma', 'text'));

    expect(conversion.columns).toEqual(['name']);
    expect(conversion.notes.join(' ')).toContain('byte order mark');
  });

  it('pads a short row and names the line it was on', () => {
    const conversion = expectOk(convertCsvToJson('a,b,c\n1,2,3\n4,5', 'comma', 'text'));

    expect(JSON.parse(conversion.output)).toEqual([
      { a: '1', b: '2', c: '3' },
      { a: '4', b: '5', c: '' },
    ]);
    expect(conversion.notes).toHaveLength(1);
    expect(conversion.notes[0]).toContain('Line 3');
  });

  it('refuses a row with more fields than the header rather than dropping them', () => {
    const message = expectFailure(convertCsvToJson('a,b\n1,2\n3,4,5', 'comma', 'text'));

    expect(message).toContain('Line 3');
    expect(message).toContain('3 fields');
    expect(message).toContain('nothing was dropped');
  });

  it('refuses a header that names a column twice, or does not name one at all', () => {
    expect(expectFailure(convertCsvToJson('a,a\n1,2', 'comma', 'text'))).toContain('“a” twice');
    expect(expectFailure(convertCsvToJson('a,,c\n1,2,3', 'comma', 'text'))).toContain('Column 2');
  });

  it('offers the delimiter the file probably wanted when everything is one column', () => {
    const conversion = expectOk(convertCsvToJson('name;born\nAda;1815', 'comma', 'text'));

    expect(conversion.columns).toEqual(['name;born']);
    expect(conversion.notes.join(' ')).toContain('semicolon');
  });

  it('keeps a padded column name exactly as the header spells it', () => {
    const conversion = expectOk(convertCsvToJson('name , born\nAda , 1815', 'comma', 'text'));

    expect(conversion.columns).toEqual(['name ', ' born']);
    expect(conversion.notes.join(' ')).toContain('space at one end');
  });

  it('converts a header with nothing under it to an empty list, and says so', () => {
    const conversion = expectOk(convertCsvToJson('a,b', 'comma', 'text'));

    expect(JSON.parse(conversion.output)).toEqual([]);
    expect(conversion.rowCount).toBe(0);
    expect(conversion.notes.join(' ')).toContain('only row');
  });

  it('reads a one-column table whose row is blank as one blank record', () => {
    const conversion = expectOk(convertCsvToJson('a\r\n""', 'comma', 'text'));

    expect(JSON.parse(conversion.output)).toEqual([{ a: '' }]);
  });
});

describe('a round trip', () => {
  /**
   * The point of the pair. Records that are already strings survive JSON to CSV
   * and back exactly; typed values survive when the cells are read as typed.
   */
  it('returns string records unchanged, through every delimiter', () => {
    const records = [
      { name: 'Lovelace, Ada', note: 'she said "no"', town: '' },
      { name: 'Hopper\nGrace', note: ' padded ', town: 'Manhattan' },
    ];

    for (const detail of csvDelimiterDetails) {
      const csv = expectOk(convertJsonToCsv(JSON.stringify(records), detail.id)).output;
      const back = expectOk(convertCsvToJson(csv, detail.id, 'text')).output;

      expect(JSON.parse(back), detail.id).toEqual(records);
    }
  });

  it('returns numbers and booleans unchanged when the cells are read as typed', () => {
    const records = [
      { name: 'Ada', born: 1815, fellow: true },
      { name: 'Grace', born: 1906, fellow: false },
    ];
    const csv = expectOk(convertJsonToCsv(JSON.stringify(records), 'comma')).output;

    expect(JSON.parse(expectOk(convertCsvToJson(csv, 'comma', 'typed')).output)).toEqual(records);
  });

  it('returns a table unchanged the other way around, which is the direction CSV starts in', () => {
    const csv = ['name,note', '"Lovelace, Ada","she said ""no"""', 'Grace,'].join(csvLineEnding);
    const json = expectOk(convertCsvToJson(csv, 'comma', 'text')).output;

    expect(expectOk(convertJsonToCsv(json, 'comma')).output).toBe(csv);
  });

  it('turns a null into an empty string, which is the one value it warns about', () => {
    const csv = expectOk(convertJsonToCsv('[{"a":null}]', 'comma')).output;

    expect(JSON.parse(expectOk(convertCsvToJson(csv, 'comma', 'text')).output)).toEqual([{ a: '' }]);
  });
});

describe('readCsvValue', () => {
  it('hands text back untouched', () => {
    for (const field of ['1', 'true', 'null', '', 'Ada']) {
      expect(readCsvValue(field, 'text'), field).toBe(field);
    }
  });

  it('takes only the literals JSON itself would write', () => {
    expect(readCsvValue('true', 'typed')).toBe(true);
    expect(readCsvValue('false', 'typed')).toBe(false);
    expect(readCsvValue('null', 'typed')).toBeNull();
    expect(readCsvValue('0', 'typed')).toBe(0);
    expect(readCsvValue('-1.5', 'typed')).toBe(-1.5);
    expect(readCsvValue('TRUE', 'typed')).toBe('TRUE');
    expect(readCsvValue('+1', 'typed')).toBe('+1');
    expect(readCsvValue('1.', 'typed')).toBe('1.');
    expect(readCsvValue('', 'typed')).toBe('');
    expect(readCsvValue(' 1 ', 'typed')).toBe(' 1 ');
  });
});

describe('describeConversion', () => {
  it('counts rows and columns, and counts one of either as one', () => {
    expect(
      describeConversion({ output: '', columns: ['a', 'b'], rowCount: 3, notes: [] }),
    ).toBe('3 rows, 2 columns');
    expect(describeConversion({ output: '', columns: ['a'], rowCount: 1, notes: [] })).toBe(
      '1 row, 1 column',
    );
  });
});

describe('the download names', () => {
  it('names a file after what is in it, since neither side brings a name', () => {
    expect(csvDownloadName).toBe('records.csv');
    expect(jsonDownloadName).toBe('records.json');
  });
});
