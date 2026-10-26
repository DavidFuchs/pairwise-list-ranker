import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import type { FormatOverride } from '@/components/data/SourceInput';
import type { FieldRoles } from '@/types/source';

/** A sample's own choice of list and fields, kept until the text is edited. */
export interface PastePreset {
  path: string[];
  /** The sample's other lists, set up with the same roles. */
  siblingPaths?: string[][];
  roles: FieldRoles;
}

export interface PasteDraftState {
  rawText: string;
  override: FormatOverride;
  /** Set by loading a sample, so setup opens with it set up to show it off. */
  preset: PastePreset | null;
  setRawText(text: string): void;
  setOverride(override: FormatOverride): void;
  /** Replaces the text with a sample and records how it is meant to be set up. */
  loadPreset(text: string, preset: PastePreset): void;
  clear(): void;
}

/**
 * What was pasted on the paste page, read again by the list setup screen. Held
 * in memory only: a reload during setup returns to the paste page.
 */
export const pasteDraft: StoreApi<PasteDraftState> = createStore<PasteDraftState>()((set) => ({
  rawText: '',
  override: 'auto',
  preset: null,
  setRawText: (text) => set({ rawText: text, preset: null }),
  setOverride: (override) => set({ override }),
  loadPreset: (text, preset) => set({ rawText: text, override: 'auto', preset }),
  clear: () => set({ rawText: '', override: 'auto', preset: null }),
}));
