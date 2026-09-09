import { describe, expect, test } from 'vitest';

import {
  formatJsonParseError,
  isJsonTextFile,
  transformJson,
  validateJson,
} from '../../src/data/json-formatter';

describe('JSON Formatter', () => {
  test('formats valid JSON with readable indentation', () => {
    expect(transformJson('{"name":"Gizlet","tools":[1,true]}', 'format')).toEqual({
      valid: true,
      output: '{\n  "name": "Gizlet",\n  "tools": [\n    1,\n    true\n  ]\n}',
    });
  });

  test('minifies valid JSON', () => {
    expect(transformJson('{\n  "name": "Gizlet",\n  "enabled": true\n}', 'minify')).toEqual({
      valid: true,
      output: '{"name":"Gizlet","enabled":true}',
    });
  });

  test('reports invalid JSON with a useful location while preserving the input for callers', () => {
    const input = '{\n  "name": "Gizlet",\n  "enabled":\n}';
    const validation = validateJson(input);

    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(formatJsonParseError(validation.error)).toMatch(/^Invalid JSON:/);
    }
    expect(formatJsonParseError({ message: 'Unexpected closing brace.', line: 4, column: 1 })).toBe(
      'Invalid JSON at line 4, column 1: Unexpected closing brace.',
    );
    expect(input).toBe('{\n  "name": "Gizlet",\n  "enabled":\n}');
  });
});

describe('recognising a JSON file', () => {
  const file = (name: string, type: string) => ({ name, type });

  test('knows one by its extension or by the type the browser reports', () => {
    expect(isJsonTextFile(file('people.json', 'application/json'))).toBe(true);
    expect(isJsonTextFile(file('PEOPLE.JSON', ''))).toBe(true);
    expect(isJsonTextFile(file('export', 'application/json'))).toBe(true);
  });

  test('says nothing about a file that only might hold JSON', () => {
    expect(isJsonTextFile(file('notes.txt', 'text/plain'))).toBe(false);
    expect(isJsonTextFile(file('orders.csv', 'text/csv'))).toBe(false);
  });
});
