/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SplitDivider } from '@/components/layout/SplitDivider';
import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH_STORAGE_KEY,
  readSidebarWidth,
  saveSidebarWidth,
} from '@/lib/hooks/useSidebarWidth';

beforeEach(() => {
  window.localStorage.clear();
});

describe('sidebar width storage', () => {
  it('starts at the default when nothing is stored', () => {
    expect(readSidebarWidth()).toBe(SIDEBAR_DEFAULT_WIDTH);
  });

  it('reads back a width the user dragged to', () => {
    saveSidebarWidth(512);

    expect(readSidebarWidth()).toBe(512);
  });

  it('ignores a stored value it cannot use', () => {
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, 'wide');
    expect(readSidebarWidth()).toBe(SIDEBAR_DEFAULT_WIDTH);

    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(SIDEBAR_MIN_WIDTH - 1));
    expect(readSidebarWidth()).toBe(SIDEBAR_DEFAULT_WIDTH);
  });

  it('forgets the width once it is reset to the default', () => {
    saveSidebarWidth(512);

    saveSidebarWidth(SIDEBAR_DEFAULT_WIDTH);

    expect(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBeNull();
  });
});

describe('SplitDivider', () => {
  function renderDivider(width = 400) {
    const props = {
      width,
      min: 300,
      max: 700,
      onResize: vi.fn(),
      onCommit: vi.fn(),
      onReset: vi.fn(),
    };
    render(<SplitDivider {...props} />);
    return { props, divider: screen.getByRole('separator', { name: /resize sidebar/i }) };
  }

  it('reports its position to assistive tech', () => {
    const { divider } = renderDivider();

    expect(divider.getAttribute('aria-orientation')).toBe('vertical');
    expect(divider.getAttribute('aria-valuenow')).toBe('400');
    expect(divider.getAttribute('aria-valuemin')).toBe('300');
    expect(divider.getAttribute('aria-valuemax')).toBe('700');
  });

  it('widens the sidebar with the left arrow and narrows it with the right', () => {
    const { props, divider } = renderDivider();

    fireEvent.keyDown(divider, { key: 'ArrowLeft' });
    expect(props.onCommit).toHaveBeenLastCalledWith(416);

    fireEvent.keyDown(divider, { key: 'ArrowRight', shiftKey: true });
    expect(props.onCommit).toHaveBeenLastCalledWith(336);
  });

  it('stays within its bounds', () => {
    const { props, divider } = renderDivider();

    fireEvent.keyDown(divider, { key: 'Home' });
    expect(props.onCommit).toHaveBeenLastCalledWith(700);

    fireEvent.keyDown(divider, { key: 'End' });
    expect(props.onCommit).toHaveBeenLastCalledWith(300);
  });

  it('keeps its arrow keys from reaching the comparison shortcuts', () => {
    const { divider } = renderDivider();
    const windowHandler = vi.fn();
    window.addEventListener('keydown', windowHandler);

    fireEvent.keyDown(divider, { key: 'ArrowLeft' });
    fireEvent.keyDown(divider, { key: 'Enter' });

    window.removeEventListener('keydown', windowHandler);
    expect(windowHandler).not.toHaveBeenCalled();
  });

  it('resets to the default on Enter or a double-click', () => {
    const { props, divider } = renderDivider();

    fireEvent.keyDown(divider, { key: 'Enter' });
    fireEvent.doubleClick(divider);

    expect(props.onReset).toHaveBeenCalledTimes(2);
  });
});
