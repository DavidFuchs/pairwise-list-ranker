import { useIsFocused } from 'expo-router';

/**
 * Whether this screen is the one in front. The web stack keeps every screen
 * it has visited mounted, hidden, so a window-level listener (a key, a file
 * drop) must check this or a screen nobody can see would act on it.
 */
export function useScreenFocused(): boolean {
  return useIsFocused();
}
