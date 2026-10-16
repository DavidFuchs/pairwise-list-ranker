/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SummaryFieldPicker } from '@/components/data/SummaryFieldPicker';
import type { ObjectSchemaHint } from '@/lib/import/labelField';
import type { FieldRenderer } from '@/types/source';

const names = ['title', 'artist', 'album', 'year', 'genre', 'mood', 'apple_music_id', 'note'];

const schema: ObjectSchemaHint = {
  itemCount: 10,
  fields: names.map((field) => ({
    field,
    types: [field === 'year' ? 'number' : 'string'],
    coverage: field === 'genre' ? 0.5 : 1,
    labelCandidate: true,
  })),
};

function setup(value: string[], renderers?: Record<string, FieldRenderer>) {
  const onChange = vi.fn();
  render(
    <SummaryFieldPicker
      schema={schema}
      labelField="title"
      value={value}
      renderers={renderers}
      onChange={onChange}
    />,
  );
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
    expect(onChange).toHaveBeenCalledWith(['artist', 'album'], undefined);
  });

  it('removes a selected field', async () => {
    const { user, onChange } = setup(['artist', 'album']);
    await user.click(screen.getByRole('button', { name: /Show artist/ }));
    expect(onChange).toHaveBeenCalledWith(['album'], undefined);
  });

  it('disables the rest once five are chosen', () => {
    setup(['artist', 'album', 'year', 'genre', 'mood']);
    expect(screen.getByRole('button', { name: /Show note/ }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: /Show artist/ }).getAttribute('aria-disabled')).not.toBe('true');
  });

  it('offers the Apple Music preview renderer for a field and applies it', async () => {
    const { user, onChange } = setup(['artist']);
    await user.click(screen.getByRole('button', { name: 'Draw apple_music_id as Apple Music preview' }));
    // Choosing a renderer also shows the field.
    expect(onChange).toHaveBeenCalledWith(['artist', 'apple_music_id'], {
      apple_music_id: 'apple-music-preview',
    });
  });

  it('puts a field back to its plain type', async () => {
    const { user, onChange } = setup(['apple_music_id'], { apple_music_id: 'apple-music-preview' });
    await user.click(screen.getByRole('button', { name: 'Draw apple_music_id as string' }));
    expect(onChange).toHaveBeenCalledWith(['apple_music_id'], undefined);
  });

  it('drops a renderer when its field is hidden', async () => {
    const { user, onChange } = setup(['apple_music_id'], { apple_music_id: 'apple-music-preview' });
    await user.click(screen.getByRole('button', { name: /Show apple_music_id/ }));
    expect(onChange).toHaveBeenCalledWith([], undefined);
  });
});
