/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Platform } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FieldSelect } from '@/components/data/FieldSelect';
import type { SortFieldCandidate } from '@/lib/import/sortField';

const FIELDS: SortFieldCandidate[] = [
  { field: 'plays', kind: 'number' },
  { field: 'rating', kind: 'number' },
];

describe('FieldSelect', () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
  });

  it('is a native select on the web', async () => {
    const onChange = vi.fn();
    render(<FieldSelect value="plays" fields={FIELDS} onChange={onChange} />);

    await userEvent.setup().selectOptions(screen.getByLabelText('Sort field'), 'rating');
    expect(onChange).toHaveBeenCalledWith('rating');
  });

  it('is a radio group of the fields away from the web', async () => {
    Platform.OS = 'ios';
    const onChange = vi.fn();
    render(<FieldSelect value="plays" fields={FIELDS} onChange={onChange} />);

    expect(screen.getByRole('radiogroup', { name: 'Sort field' })).toBeDefined();
    expect(screen.getByRole('radio', { name: 'plays' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'rating' }).getAttribute('aria-checked')).toBe('false');

    await userEvent.setup().click(screen.getByRole('radio', { name: 'rating' }));
    expect(onChange).toHaveBeenCalledWith('rating');
  });
});
