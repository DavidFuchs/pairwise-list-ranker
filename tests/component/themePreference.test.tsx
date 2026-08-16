/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { applyThemePreference, readThemePreference } from '@/lib/hooks/useThemePreference';
import { THEME_STORAGE_KEY } from '@/lib/themeCss';

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('readThemePreference', () => {
  it('follows the system when nothing is stored', () => {
    expect(readThemePreference()).toBe('system');
  });

  it('reads a stored preference', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    expect(readThemePreference()).toBe('dark');
  });

  it('ignores a value it does not recognise', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'neon');

    expect(readThemePreference()).toBe('system');
  });
});

describe('applyThemePreference', () => {
  it('pins the document to dark', () => {
    applyThemePreference('dark');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('pins the document to light', () => {
    applyThemePreference('light');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('hands control back to the system', () => {
    applyThemePreference('dark');

    applyThemePreference('system');

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });
});

describe('ThemeToggle', () => {
  it('offers system, light, and dark', () => {
    render(<ThemeToggle />);

    expect(screen.getByRole('button', { name: /match system theme/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /use the light theme/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /use the dark theme/i })).toBeDefined();
  });

  it('starts on system when the visitor has no preference', () => {
    render(<ThemeToggle />);

    expect(
      screen.getByRole('button', { name: /match system theme/i }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('switches the document to dark when asked', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: /use the dark theme/i }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(
      screen.getByRole('button', { name: /use the dark theme/i }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('shows the stored preference once it has mounted', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');

    render(<ThemeToggle />);

    expect(
      screen.getByRole('button', { name: /use the light theme/i }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('returns to following the system', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button', { name: /use the dark theme/i }));

    await user.click(screen.getByRole('button', { name: /match system theme/i }));

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
