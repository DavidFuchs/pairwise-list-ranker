import { useCallback, useEffect, useState } from 'react';

import { useScreenFocused } from '@/lib/hooks/useScreenFocused';

export type ShortcutSide = 'left' | 'right';
/** Which cards a "don't recognize" mark covers: one side, or both. */
export type RecognizeTarget = ShortcutSide | 'both';

export interface ComparisonShortcutHandlers {
  onChoose: (side: ShortcutSide, strong: boolean) => void;
  /** Records the pair as too close to call, a draw. */
  onCantDecide: () => void;
  /** Arms a delete for confirmation; it must never delete outright. */
  onArmDelete: (side: ShortcutSide) => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  /** Arms "don't recognize" (K); it marks nothing until L, R or B names the cards. */
  onArmRecognize: () => void;
  onMarkRecognize: (target: RecognizeTarget) => void;
  onCancelRecognize: () => void;
  /** Takes back the last decision. Bound to Ctrl/Cmd+Z; absent when there is nothing to undo. */
  onUndo?: () => void;
  /** True while a delete is waiting for confirmation. */
  armed: boolean;
  /** True while "don't recognize" is waiting for L, R or B. */
  recognizeArmed: boolean;
  /** Whether any key is listened for. */
  enabled: boolean;
  /**
   * False when there is no pair to answer: only Ctrl/Cmd+Z still works, so
   * an answer can be taken back when nothing is left to ask.
   */
  canAnswer?: boolean;
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
 * Keyboard shortcuts for the comparison stage (docs/UX.md): arrows choose, shift +
 * arrow marks a much-better win, S can't decide, D followed by L or R arms a
 * delete, and K followed by L, R or B marks the left, right or both items as
 * not recognized. Keystrokes are ignored while the user is typing somewhere,
 * and the keys a focused radio group uses are left to it.
 */
export function useComparisonShortcuts({
  onChoose,
  onCantDecide,
  onArmDelete,
  onConfirmDelete,
  onCancelDelete,
  onArmRecognize,
  onMarkRecognize,
  onCancelRecognize,
  onUndo,
  armed,
  recognizeArmed,
  enabled,
  canAnswer = true,
}: ComparisonShortcutHandlers): ComparisonShortcutState {
  /** Set by pressing D; the next L or R picks the side. */
  const [sideRequested, setSideRequested] = useState(false);
  // A prompt for the second half of a shortcut has no business outliving
  // the stage it was typed on, or a delete that already found its side, so
  // those two cases are read off the props rather than remembered.
  const focused = useScreenFocused();
  const awaitingSide = sideRequested && !armed && !recognizeArmed && enabled && canAnswer;

  useEffect(() => {
    // A screen kept mounted behind the one in front hears no keys.
    if (!enabled || !focused || typeof window === 'undefined') return;

    const handler = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || isRadioKey(event)) return;

      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'z'
      ) {
        if (armed || onUndo === undefined) return;
        event.preventDefault();
        // An undo that leaves the same pair on screen must not leave a prompt armed.
        if (recognizeArmed) onCancelRecognize();
        onUndo();
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey || !canAnswer) return;

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

      if (recognizeArmed) {
        // Only L, R, B and Esc act: a stray arrow or S must not answer the pair
        // out from under a prompt that says it is waiting for something else.
        const key = event.key.toLowerCase();
        if (key === 'l' || key === 'r' || key === 'b') {
          event.preventDefault();
          onMarkRecognize(key === 'l' ? 'left' : key === 'r' ? 'right' : 'both');
        } else if (event.key === 'Escape') {
          event.preventDefault();
          onCancelRecognize();
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
          onCantDecide();
          break;
        case 'd':
          event.preventDefault();
          setSideRequested(true);
          break;
        case 'k':
          event.preventDefault();
          onArmRecognize();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    onChoose,
    onCantDecide,
    onArmDelete,
    onConfirmDelete,
    onCancelDelete,
    onArmRecognize,
    onMarkRecognize,
    onCancelRecognize,
    onUndo,
    armed,
    recognizeArmed,
    sideRequested,
    enabled,
    focused,
    canAnswer,
  ]);

  return { awaitingSide, clearAwaitingSide: useCallback(() => setSideRequested(false), []) };
}

/** Whether the key is going into a text field, where no shortcut should act. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (target === null || !(target instanceof Element)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.hasAttribute('contenteditable');
}

/**
 * Whether the key belongs to a radio group the user has focused, such as the
 * sort-mode control: there the arrows move between its options and Enter and
 * Space choose, so none of them may answer, order or submit anything.
 */
export function isRadioKey(event: KeyboardEvent): boolean {
  const { target } = event;
  if (target === null || !(target instanceof Element)) return false;
  if (target.closest('[role="radiogroup"], [role="radio"]') === null) return false;
  return event.key.startsWith('Arrow') || event.key === 'Enter' || event.key === ' ';
}

/** Whether the key would already activate whatever the user has focused. */
export function isActivatableTarget(target: EventTarget | null): boolean {
  if (target === null || !(target instanceof Element)) return false;
  const role = target.getAttribute('role');
  return target.tagName === 'BUTTON' || target.tagName === 'A' || role === 'button' || role === 'link';
}
