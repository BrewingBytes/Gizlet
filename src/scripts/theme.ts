export type Theme = 'dark' | 'light';

export const themeStorageKey = 'gizlet-theme';

export function parseThemePreference(value: string | null): Theme | null {
  return value === 'dark' || value === 'light' ? value : null;
}

export function resolveTheme(preference: Theme | null, systemTheme: Theme): Theme {
  return preference ?? systemTheme;
}

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readThemePreference(): Theme | null {
  try {
    return parseThemePreference(window.localStorage.getItem(themeStorageKey));
  } catch {
    return null;
  }
}

function storeThemePreference(theme: Theme): void {
  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {
    // Keep the selected theme for this page even when storage is unavailable.
  }
}

/** The visible label follows `data-theme` in CSS, so this only updates state. */
function applyTheme(theme: Theme, toggle: HTMLButtonElement): void {
  document.documentElement.dataset.theme = theme;
  toggle.setAttribute('aria-pressed', String(theme === 'dark'));
  toggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
}

export function initializeThemeToggle(): void {
  const toggle = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');

  if (!toggle) {
    return;
  }

  applyTheme(resolveTheme(readThemePreference(), getSystemTheme()), toggle);

  toggle.addEventListener('click', () => {
    const nextTheme: Theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';

    storeThemePreference(nextTheme);
    applyTheme(nextTheme, toggle);
  });
}
