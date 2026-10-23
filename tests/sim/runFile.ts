import type { PickerName } from '@/tests/sim/overrides';

/**
 * Guards for baseline.sim.ts's output, so a run cannot overwrite the committed
 * reference by accident.
 */

/** Throws when an override run, or a run with another picker, would take the reference label. */
export function checkLabel(
  label: string,
  overrides: Record<string, unknown>,
  picker: PickerName,
  filter?: string,
): void {
  if (label !== 'baseline') return;
  if (filter !== undefined && filter !== '') {
    throw new Error(
      `A run with SIM_FILTER must set its own SIM_LABEL: "baseline" is the reference run of every scenario.`,
    );
  }
  if (Object.keys(overrides).length > 0) {
    throw new Error('A run with SIM_OVERRIDES must set its own SIM_LABEL: "baseline" is the reference run.');
  }
  if (picker !== 'current') {
    throw new Error(
      `A run with SIM_PICKER=${picker} must set its own SIM_LABEL: "baseline" is the reference run.`,
    );
  }
}

/** The SIM_FILTER regular expression, or undefined when unset or empty. Throws naming an invalid one. */
export function parseFilter(raw: string | undefined): RegExp | undefined {
  if (raw === undefined || raw === '') return undefined;
  try {
    return new RegExp(raw);
  } catch {
    throw new Error(`SIM_FILTER is not a valid regular expression: ${raw}`);
  }
}

/** The scenarios whose name or any tag matches the filter; all of them when there is none. */
export function selectScenarios<T extends { name: string; tags?: string[] }>(
  all: readonly T[],
  filter: RegExp | undefined,
): T[] {
  if (!filter) return [...all];
  return all.filter((s) => filter.test(s.name) || (s.tags ?? []).some((tag) => filter.test(tag)));
}

/** The file name for a result: `<label>.json` only when every scenario ran, else `<label>.partial.json`. */
export function resultFileName(label: string, ran: number, expected: number): string {
  return ran === expected ? `${label}.json` : `${label}.partial.json`;
}
