/** @vitest-environment jsdom */
import { fireEvent, render } from '@testing-library/react';
import { Text } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '@/components/layout/AppShell';
import { useComparisonShortcuts } from '@/lib/hooks/useComparisonShortcuts';

const screen = vi.hoisted(() => ({ focused: true }));
vi.mock('@/lib/hooks/useScreenFocused', () => ({ useScreenFocused: () => screen.focused }));

function Shortcuts({ onChoose }: { onChoose: () => void }) {
  useComparisonShortcuts({
    onChoose,
    onCantDecide: vi.fn(),
    onArmDelete: vi.fn(),
    onConfirmDelete: vi.fn(),
    onCancelDelete: vi.fn(),
    onArmRecognize: vi.fn(),
    onMarkRecognize: vi.fn(),
    onCancelRecognize: vi.fn(),
    armed: false,
    recognizeArmed: false,
    enabled: true,
  });
  return null;
}

beforeEach(() => {
  screen.focused = true;
});

describe('a screen kept mounted behind another', () => {
  it('answers keys while it is in front', () => {
    const onChoose = vi.fn();
    render(<Shortcuts onChoose={onChoose} />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  it('ignores keys while it is not in front, and hears them again when it returns', () => {
    const onChoose = vi.fn();
    screen.focused = false;
    const { rerender } = render(<Shortcuts onChoose={onChoose} />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onChoose).not.toHaveBeenCalled();

    screen.focused = true;
    rerender(<Shortcuts onChoose={onChoose} />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  function drop(file: File) {
    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'], files: [file] } });
    window.dispatchEvent(event);
  }

  it('takes a dropped file only while it is in front', () => {
    const onFileDrop = vi.fn();
    const file = new File(['x'], 'a.txt');
    const { rerender } = render(
      <AppShell stage={<Text>Stage</Text>} preview={<Text>Preview</Text>} onFileDrop={onFileDrop} />,
    );
    drop(file);
    expect(onFileDrop).toHaveBeenCalledTimes(1);

    screen.focused = false;
    rerender(<AppShell stage={<Text>Stage</Text>} preview={<Text>Preview</Text>} onFileDrop={onFileDrop} />);
    drop(file);
    expect(onFileDrop).toHaveBeenCalledTimes(1);
  });
});
