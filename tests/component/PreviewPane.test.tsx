/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PreviewPane } from '@/components/preview/PreviewPane';
import { selectRanking } from '@/lib/state/selectors';
import type { ListItem } from '@/types/list';

const NOW = '2026-08-15T12:00:00.000Z';

function item(id: string, value: ListItem['value']): ListItem {
  return { id, listId: 'list-1', value, active: true, createdAt: NOW, updatedAt: NOW };
}

const items = [item('item-1', 'Tacos'), item('item-2', 'Ramen')];
const ranking = selectRanking(items, []);

function setup(overrides: Partial<React.ComponentProps<typeof PreviewPane>> = {}) {
  const props = {
    mode: 'gui' as const,
    ranking,
    exportText: 'version: 1\ntitle: Dinners\n',
    filename: 'dinners-2026-08-15.yaml',
    issues: [],
    onModeChange: vi.fn(),
    onDraftChange: vi.fn(),
    onApply: vi.fn(),
    ...overrides,
  };
  render(<PreviewPane {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe('PreviewPane in GUI mode', () => {
  it('shows the ranked list with positions', () => {
    setup();

    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('Tacos')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
  });

  it('offers no copy or download, because the GUI view is not exportable', () => {
    setup();

    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull();
  });

  it('offers no editor in GUI mode', () => {
    setup();

    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('switches modes from the tabs', async () => {
    const { onModeChange, user } = setup();

    await user.click(screen.getByRole('tab', { name: /yaml/i }));

    expect(onModeChange).toHaveBeenCalledWith('yaml');
  });

  it('marks the active tab as selected', () => {
    setup();

    expect(screen.getByRole('tab', { name: /gui/i }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('PreviewPane in a text mode', () => {
  it('shows the serialized list in an editable field', () => {
    setup({ mode: 'yaml' });

    const editor = screen.getByRole('textbox');
    expect((editor as HTMLTextAreaElement).value).toContain('title: Dinners');
  });

  it('offers copy and download', () => {
    setup({ mode: 'yaml' });

    expect(screen.getByRole('button', { name: /copy/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /download/i })).toBeDefined();
  });

  it('shows the download filename so the user knows what they get', () => {
    setup({ mode: 'yaml' });

    expect(screen.getByText(/dinners-2026-08-15\.yaml/)).toBeDefined();
  });

  it('reports typing without importing anything', async () => {
    const { onDraftChange, onApply, user } = setup({ mode: 'yaml' });

    await user.type(screen.getByRole('textbox'), 'x');

    expect(onDraftChange).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('shows the edited draft instead of the export text', () => {
    setup({ mode: 'json', draft: '{"draft": true}' });

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('{"draft": true}');
  });

  it('imports the draft when asked', async () => {
    const { onApply, user } = setup({ mode: 'json', draft: '[]' });

    await user.click(screen.getByRole('button', { name: /import/i }));

    expect(onApply).toHaveBeenCalled();
  });

  it('has nothing to import until the text is edited', () => {
    setup({ mode: 'json' });

    expect(
      screen.getByRole('button', { name: /import/i }).getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('shows parse problems with their line numbers', () => {
    setup({
      mode: 'json',
      draft: '{ broken',
      issues: [{ path: '', message: 'Invalid JSON: unexpected token', line: 1 }],
    });

    expect(screen.getByText(/line 1/i)).toBeDefined();
    expect(screen.getByText(/unexpected token/i)).toBeDefined();
  });

  it('keeps the user text on screen when parsing failed', () => {
    setup({
      mode: 'json',
      draft: '{ broken',
      issues: [{ path: '', message: 'Invalid JSON', line: 1 }],
    });

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('{ broken');
  });
});
