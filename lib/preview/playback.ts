import { useSyncExternalStore } from 'react';

/*
 * One shared audio element for every catalogue: starting a preview stops the
 * one before it. Clips are keyed by catalogue and id, like "apple:1001".
 */

let audio: HTMLAudioElement | null = null;
let playingKey: string | null = null;
const listeners = new Set<() => void>();

function setPlaying(key: string | null): void {
  playingKey = key;
  for (const listener of listeners) listener();
}

export function togglePreview(key: string, url: string): void {
  if (typeof Audio === 'undefined') return;
  if (audio === null) {
    audio = new Audio();
    audio.addEventListener('ended', () => setPlaying(null));
  }
  if (playingKey === key) {
    audio.pause();
    setPlaying(null);
    return;
  }
  audio.src = url;
  setPlaying(key);
  audio.play().catch(() => setPlaying(null));
}

/** Silences any preview, e.g. when the card it belongs to is replaced. */
export function stopPreview(key: string): void {
  if (playingKey !== key) return;
  audio?.pause();
  setPlaying(null);
}

export function useIsPlaying(key: string): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => playingKey === key,
    () => false,
  );
}
