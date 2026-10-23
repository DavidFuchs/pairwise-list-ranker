/** @vitest-environment jsdom */
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RecognizePill } from '@/components/comparison/RecognizePill';

/** Holds the armed state the way the deck does. */
function Harness({ onMarkAll, onCancel }: { onMarkAll: () => void; onCancel: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <RecognizePill
      onCantDecide={vi.fn()}
      armed={armed}
      onArm={() => setArmed(true)}
      onMarkAll={onMarkAll}
      markAllLabel="Don't recognize either"
      onCancel={() => {
        onCancel();
        setArmed(false);
      }}
    />
  );
}

/** The labels a half is kept wide enough for. */
function widthFor(half: Element): string[] {
  const widest = half.querySelector('[data-widest="true"]');
  return Array.from(widest?.children ?? [], (label) => label.textContent ?? '');
}

describe('RecognizePill', () => {
  it('a second press where the arming press was is Cancel, not mark all', async () => {
    const onMarkAll = vi.fn();
    const onCancel = vi.fn();
    render(<Harness onMarkAll={onMarkAll} onCancel={onCancel} />);
    const user = userEvent.setup();

    const spot = screen.getByRole('button', { name: "Don't recognize…" });
    await user.click(spot);
    // The half that was pressed is still there, and is now Cancel.
    expect(spot.getAttribute('aria-label')).toBe('Cancel');
    await user.click(spot);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onMarkAll).not.toHaveBeenCalled();
  });

  it('each half is kept as wide as its widest label, so arming moves neither', async () => {
    render(<Harness onMarkAll={vi.fn()} onCancel={vi.fn()} />);
    const user = userEvent.setup();

    const first = screen.getByRole('button', { name: "Can't decide" });
    const second = screen.getByRole('button', { name: "Don't recognize…" });
    expect(widthFor(first)).toEqual(["Can't decide", "Don't recognize either"]);
    expect(widthFor(second)).toEqual(["Don't recognize…", 'Cancel']);

    await user.click(second);

    expect(widthFor(screen.getByRole('button', { name: "Don't recognize either" }))).toEqual([
      "Can't decide",
      "Don't recognize either",
    ]);
    expect(widthFor(screen.getByRole('button', { name: 'Cancel' }))).toEqual(["Don't recognize…", 'Cancel']);
  });
});
