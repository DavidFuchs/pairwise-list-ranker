/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PreviewTabs } from '@/components/preview/PreviewTabs';

describe('PreviewTabs', () => {
  it('shows only the tabs it was given', () => {
    render(<PreviewTabs tab="ranked" tabs={['ranked', 'yaml']} onChange={vi.fn()} />);

    expect(screen.getByRole('tab', { name: /ranked/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /yaml/i })).toBeDefined();
    expect(screen.queryByRole('tab', { name: /json/i })).toBeNull();
  });

  it('labels a plain list tab readably', () => {
    render(<PreviewTabs tab="list" tabs={['ranked', 'list']} onChange={vi.fn()} />);

    expect(screen.getByRole('tab', { name: /plain list/i })).toBeDefined();
  });

  it('marks the active tab', () => {
    render(<PreviewTabs tab="yaml" tabs={['ranked', 'yaml']} onChange={vi.fn()} />);

    expect(screen.getByRole('tab', { name: /yaml/i }).getAttribute('aria-selected')).toBe('true');
  });

  it('reports a tab change', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PreviewTabs tab="ranked" tabs={['ranked', 'json']} onChange={onChange} />);

    await user.click(screen.getByRole('tab', { name: /json/i }));

    expect(onChange).toHaveBeenCalledWith('json');
  });
});
