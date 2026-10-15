import { useCallback, useEffect, useState } from 'react';

export type ShortcutSide = 'left' | 'right';

export interface ComparisonShortcutHandlers {
  onChoose: (side: ShortcutSide, strong: boolean) => void;
  onSkip: () => void;
  /** Arms a delete for confirmation; it must never delete outright. */
  onArmDelete: (side: ShortcutSide) => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  /** Takes back the last decision. Bound to Ctrl/Cmd+Z; absent when there is nothing to undo. */
  onUndo?: () => void;
  /** True while a delete is waiting for confirmation. */
  armed: boolean;
  enabled: boolean;
}

export interface ComparisonShortcutState {
  /**
   * True between D and the L or R that picks a side. The deck says so on
   * screen: a half-finished shortcut the user cannot see is a dead end.
   */
  awaitingSide: boolean;
  /** Abandons a half-pressed D when the user acts by pointer instead. */
  clearAwaitingSide: () => void;
}

/**
 * Keyboard shortcuts for the comparison stage (UX.md): arrows choose, shift +
 * arrow marks a much-better win, S skips, and D followed by L or R arms a
 * delete. Keystrokes are ignored while the user is typing somewhere.
 */
export function useComparisonShortcuts({
  onChoose,
  onSkip,
  onArmDelete,
  onConfirmDelete,
  onCancelDelete,
  onUndo,
  armed,
  enabled,
}: ComparisonShortcutHandlers): ComparisonShortcutState {
  /** Set by pressing D; the next L or R picks the side. */
  const [sideRequested, setSideRequested] = useState(false);
  // A prompt for the second half of a shortcut has no business outliving
  // the stage it was typed on, or a delete that already found its side, so
  // those two cases are read off the props rather than remembered.
  const awaitingSide = sideRequested && !armed && enabled;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handler = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'z') {
        if (armed || onUndo === undefined) return;
        event.preventDefault();
        onUndo();
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (armed) {
        // Enter is bound globally so the confirmation answers the hand already
        // on the keyboard - but a focused button says on its face what it
        // does, so there Enter belongs to the button rather than to us.
        if (event.key === 'Enter' && !isActivatableTarget(event.target)) {
          event.preventDefault();
          onConfirmDelete();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          onCancelDelete();
        }
        return;
      }

      const key = event.key.toLowerCase();

      if (sideRequested) {
        setSideRequested(false);
        if (key === 'l' || key === 'r') {
          event.preventDefault();
          onArmDelete(key === 'l' ? 'left' : 'right');
        }
        return;
      }

      switch (key) {
        case 'arrowleft':
          event.preventDefault();
          onChoose('left', event.shiftKey);
          break;
        case 'arrowright':
          event.preventDefault();
          onChoose('right', event.shiftKey);
          break;
        case 's':
          event.preventDefault();
          onSkip();
          break;
        case 'd':
          event.preventDefault();
          setSideRequested(true);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    onChoose,
    onSkip,
    onArmDelete,
    onConfirmDelete,
    onCancelDelete,
    onUndo,
    armed,
    sideRequested,
    enabled,
  ]);

  return { awaitingSide, clearAwaitingSide: useCallback(() => setSideRequested(false), []) };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (target === null || !(target instanceof Element)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.hasAttribute('contenteditable');
}

/** Whether the key would already activate whatever the user has focused. */
function isActivatableTarget(target: EventTarget | null): boolean {
  if (target === null || !(target instanceof Element)) return false;
  const role = target.getAttribute('role');
  return target.tagName === 'BUTTON' || target.tagName === 'A' || role === 'button' || role === 'link';
}
