import { useEffect } from 'react';

export type ShortcutSide = 'left' | 'right';

export interface ComparisonShortcutHandlers {
  onChoose: (side: ShortcutSide, strong: boolean) => void;
  onSkip: () => void;
  /** Arms a delete for confirmation; it must never delete outright. */
  onArmDelete: (side: ShortcutSide) => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  /** True while a delete is waiting for confirmation. */
  armed: boolean;
  enabled: boolean;
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
  armed,
  enabled,
}: ComparisonShortcutHandlers): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    /** Set by pressing D; the next L or R picks the side. */
    let deletePending = false;

    const handler = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;

      if (armed) {
        if (event.key === 'Enter') {
          event.preventDefault();
          onConfirmDelete();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          onCancelDelete();
        }
        return;
      }

      const key = event.key.toLowerCase();

      if (deletePending) {
        deletePending = false;
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
          deletePending = true;
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onChoose, onSkip, onArmDelete, onConfirmDelete, onCancelDelete, armed, enabled]);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (target === null || !(target instanceof Element)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.hasAttribute('contenteditable');
}
