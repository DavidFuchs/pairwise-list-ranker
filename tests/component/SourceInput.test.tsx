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
    issues: [],
    ...overrides,
  };
  render(<SourceInput {...props} />);
  return { ...props, user: userEvent.setup() };
}

async function openSamples(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /try a sample list/i }));
}

describe('SourceInput', () => {
  it('reports typed text', () => {
    const { onChange } = setup();

    fireEvent.change(screen.getByLabelText(/your list/i), { target: { value: 'Alien' } });

    expect(onChange).toHaveBeenCalledWith('Alien');
  });

  it('shows the text it was given', () => {
    setup({ value: 'Alien\nArrival' });

    expect((screen.getByLabelText(/your list/i) as HTMLTextAreaElement).value).toBe('Alien\nArrival');
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

  it('keeps the samples in a menu until asked, one entry per sample, saying what it loads', async () => {
    const { user } = setup();
    expect(screen.queryByRole('menuitem', { name: /load the songs sample/i })).toBeNull();

    await openSamples(user);

    expect(screen.getByRole('menuitem', { name: /load the songs sample/i })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: /load the movies sample/i })).toBeDefined();
    expect(screen.getByText('10 songs, as JSON')).toBeDefined();
    expect(screen.getByText('10 movies, as YAML')).toBeDefined();
    expect(screen.getByRole('menuitem', { name: /load the games sample/i })).toBeDefined();
    expect(screen.getByText('10 games, as YAML')).toBeDefined();
  });

  it('closes the menu once a sample is picked, and on Escape', async () => {
    const { user } = setup();

    await openSamples(user);
    await user.click(screen.getByRole('menuitem', { name: /load the songs sample/i }));
    expect(screen.queryByRole('menu')).toBeNull();

    await openSamples(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('hands the chosen sample over, whichever format tab is active', async () => {
    const onSample = vi.fn();
    const { onOverrideChange, user } = setup({ override: 'list', onSample });

    await openSamples(user);
    await user.click(screen.getByRole('menuitem', { name: /load the movies sample/i }));

    expect(onSample).toHaveBeenCalledWith(expect.objectContaining({ id: 'movies', format: 'yaml' }));
    expect(onOverrideChange).not.toHaveBeenCalled();
  });

  it('treats a sample as typing when no one handles samples', async () => {
    const { onChange, user } = setup();

    await openSamples(user);
    await user.click(screen.getByRole('menuitem', { name: /load the songs sample/i }));

    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('"song_name"'));
  });

  it('keeps the format tabs to choosing a format', () => {
    setup();

    expect(screen.queryByRole('button', { name: /load the (plain list|yaml|json) sample/i })).toBeNull();
  });

  it('hides a format tab the current data cannot honestly become', () => {
    setup({ availableOverrides: ['auto', 'yaml', 'json'] });

    expect(screen.queryByRole('radio', { name: /read the text as a plain list/i })).toBeNull();
    expect(screen.getByRole('radio', { name: /read the text as yaml/i })).toBeDefined();
  });
});
