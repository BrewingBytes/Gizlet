import { expect, test } from 'vitest';
import { parseThemePreference, resolveTheme } from '../../src/scripts/theme';

test('accepts only supported stored theme preferences', () => {
  expect(parseThemePreference('dark')).toBe('dark');
  expect(parseThemePreference('light')).toBe('light');
  expect(parseThemePreference('system')).toBeNull();
  expect(parseThemePreference(null)).toBeNull();
});

test('uses the system theme only when no explicit preference exists', () => {
  expect(resolveTheme(null, 'dark')).toBe('dark');
  expect(resolveTheme(null, 'light')).toBe('light');
  expect(resolveTheme('light', 'dark')).toBe('light');
});
