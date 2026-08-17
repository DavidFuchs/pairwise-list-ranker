/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SourceInput } from '@/components/data/SourceInput';

function setup(overrides: Partial<React.ComponentProps<typeof SourceInput>> = {}) {
  const props = {
    value: '',
    onChange: vi.fn(),
    override: 'auto' as const,
    onOverrideChange: vi.fn(),
    format: 'list' as const,
    issues: [],
    ...overrides,
  };
  render(<SourceInput {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe('SourceInput', () => {
  it('reports typed text', () => {
    const { onChange } = setup();

    fireEvent.change(screen.getByLabelText(/your list/i), { target: { value: 'Alien' } });

    expect(onChange).toHaveBeenCalledWith('Alien');
  });

  it('shows the text it was given', () => {
    setup({ value: 'Alien\nArrival' });

    expect((screen.getByLabelText(/your list/i) as HTMLTextAreaElement).value).toBe(
      'Alien\nArrival',
    );
  });

  it('names the format it detected', () => {
    setup({ value: 'movies:\n  - a\n  - b\n', format: 'yaml' });

    expect(screen.getByText(/read as yaml/i)).toBeDefined();
  });

  it('says nothing about the format while the box is empty', () => {
    setup();

    expect(screen.queryByText(/read as/i)).toBeNull();
  });

  it('offers each format override', () => {
    setup();

    expect(screen.getByRole('radio', { name: /detect the format automatically/i })).toBeDefined();
    expect(screen.getByRole('radio', { name: /read the text as a plain list/i })).toBeDefined();
    expect(screen.getByRole('radio', { name: /read the text as yaml/i })).toBeDefined();
    expect(screen.getByRole('radio', { name: /read the text as json/i })).toBeDefined();
  });

  it('reports an override', async () => {
    const { onOverrideChange, user } = setup();

    await user.click(screen.getByRole('radio', { name: /read the text as a plain list/i }));

    expect(onOverrideChange).toHaveBeenCalledWith('list');
  });

  it('shows a parse error with its line number', () => {
    setup({ issues: [{ path: '', message: 'Invalid JSON: unexpected token', line: 2 }] });

    expect(screen.getByText(/line 2/i)).toBeDefined();
    expect(screen.getByText(/unexpected token/i)).toBeDefined();
  });

  it('shows a parse error with no line number', () => {
    setup({ issues: [{ path: '', message: 'There is nothing to read yet.' }] });

    expect(screen.getByText(/nothing to read yet/i)).toBeDefined();
  });

  it('keeps the text when a parse fails', () => {
    setup({ value: '{ broken', issues: [{ path: '', message: 'Invalid JSON: oops' }] });

    expect((screen.getByLabelText(/your list/i) as HTMLTextAreaElement).value).toBe('{ broken');
  });

  it('offers a file picker', () => {
    setup();

    expect(screen.getByLabelText(/choose a file to import/i)).toBeDefined();
  });
});
