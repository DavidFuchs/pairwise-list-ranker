/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SummaryFieldPicker } from '@/components/data/SummaryFieldPicker';
import type { ObjectSchemaHint } from '@/lib/import/labelField';

const schema: ObjectSchemaHint = {
  itemCount: 10,
  fields: ['title', 'artist', 'album', 'year', 'genre'].map((field) => ({
    field,
    types: ['string'],
    coverage: field === 'genre' ? 0.5 : 1,
    labelCandidate: true,
  })),
};

function setup(value: string[]) {
  const onChange = vi.fn();
  render(<SummaryFieldPicker schema={schema} labelField="title" value={value} onChange={onChange} />);
  return { onChange, user: userEvent.setup() };
}

describe('SummaryFieldPicker', () => {
  it('does not offer the title field', () => {
    setup([]);
    expect(screen.queryByRole('button', { name: /Show title/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Show artist/ })).toBeDefined();
  });

  it('adds a field to the end of the selection', async () => {
    const { user, onChange } = setup(['artist']);
    await user.click(screen.getByRole('button', { name: /Show album/ }));
    expect(onChange).toHaveBeenCalledWith(['artist', 'album']);
  });

  it('removes a selected field', async () => {
    const { user, onChange } = setup(['artist', 'album']);
    await user.click(screen.getByRole('button', { name: /Show artist/ }));
    expect(onChange).toHaveBeenCalledWith(['album']);
  });

  it('disables the rest once three are chosen', () => {
    setup(['artist', 'album', 'year']);
    expect(screen.getByRole('button', { name: /Show genre/ }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: /Show artist/ }).getAttribute('aria-disabled')).not.toBe('true');
  });
});
