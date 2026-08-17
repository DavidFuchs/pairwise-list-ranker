/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LabelPicker } from '@/components/data/LabelPicker';
import { collectLabelFieldCandidates } from '@/lib/import/labelField';

const films = [
  { title: 'Arrival', year: 2016, director: 'Denis Villeneuve', cast: ['Amy Adams'] },
  { title: 'Alien', year: 1979, director: 'Ridley Scott', cast: ['Sigourney Weaver'] },
];

function setup(overrides: Partial<React.ComponentProps<typeof LabelPicker>> = {}) {
  const props = {
    candidates: collectLabelFieldCandidates(films),
    schema: { itemCount: 2, fields: [] },
    onChange: vi.fn(),
    ...overrides,
  };
  render(<LabelPicker {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe('LabelPicker', () => {
  it('offers every scalar field as a choice', () => {
    setup();

    expect(screen.getByRole('button', { name: /label items by title/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /label items by year/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /label items by director/i })).toBeDefined();
  });

  it('does not offer fields that cannot be a label', () => {
    setup();

    expect(screen.queryByRole('button', { name: /label items by cast/i })).toBeNull();
  });

  it('previews the labels a field would produce', () => {
    setup();

    expect(screen.getByText(/Arrival/)).toBeDefined();
  });

  it('reports the chosen field', async () => {
    const { onChange, user } = setup();

    await user.click(screen.getByRole('button', { name: /label items by year/i }));

    expect(onChange).toHaveBeenCalledWith('year');
  });

  it('marks the current choice as selected', () => {
    setup({ value: 'title' });

    expect(
      screen.getByRole('button', { name: /label items by title/i }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('asks for a choice while none is made', () => {
    setup();

    expect(screen.getByText(/choose which field/i)).toBeDefined();
  });

  it('stops asking once a field is chosen', () => {
    setup({ value: 'title' });

    expect(screen.queryByText(/choose which field/i)).toBeNull();
  });

  it('warns when a field is missing from some items', () => {
    const patchy = [{ title: 'Arrival', year: 2016 }, { title: 'Alien' }];
    setup({ candidates: collectLabelFieldCandidates(patchy) });

    expect(screen.getByText(/1 of 2 items/i)).toBeDefined();
  });

  it('says when there is nothing to pick from', () => {
    setup({ candidates: [] });

    expect(screen.getByText(/no fields/i)).toBeDefined();
  });
});
