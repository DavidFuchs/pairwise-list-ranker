/** @vitest-environment jsdom */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExternalChangeNotice } from '@/components/layout/ExternalChangeNotice';
import { listStore } from '@/lib/state/useListStore';

const focus = vi.hoisted(() => ({ focused: true }));

vi.mock('@/lib/hooks/useScreenFocused', () => ({ useScreenFocused: () => focus.focused }));

afterEach(() => {
  vi.useRealTimers();
  focus.focused = true;
  listStore.setState({ externalChange: 'none' });
});

describe('ExternalChangeNotice', () => {
  it('says nothing while nothing has changed', () => {
    render(<ExternalChangeNotice />);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('asks a tab in front what to do, and Reload takes the other tab’s copy', async () => {
    const reload = vi.fn();
    listStore.setState({ externalChange: 'waiting', reloadFromStorage: reload });
    render(<ExternalChangeNotice />);

    expect(screen.getByRole('alert').textContent).toContain('changed in another tab');
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('lets the user keep this tab’s version', async () => {
    const keep = vi.fn();
    listStore.setState({ externalChange: 'waiting', keepThisTab: keep });
    render(<ExternalChangeNotice />);

    await userEvent.click(screen.getByRole('button', { name: "Keep this tab's version" }));

    expect(keep).toHaveBeenCalledTimes(1);
  });

  it('tells a refreshed tab so, then goes away on its own', () => {
    vi.useFakeTimers();
    listStore.setState({ externalChange: 'refreshed' });
    render(<ExternalChangeNotice />);

    expect(screen.getByRole('status').textContent).toBe('Updated from another tab.');
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByRole('status')).toBeNull();
    expect(listStore.getState().externalChange).toBe('none');
  });

  it('stays quiet on a screen kept behind the one in front', () => {
    focus.focused = false;
    listStore.setState({ externalChange: 'waiting' });
    render(<ExternalChangeNotice />);

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
