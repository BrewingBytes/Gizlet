import { describe, expect, test } from 'vitest';

import {
  formatJsonParseError,
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
