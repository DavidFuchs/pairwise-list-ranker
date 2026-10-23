/**
 * Per-run overrides of the engine's tunable constants, read from the
 * SIM_OVERRIDES environment variable as a JSON object, for example
 * `{"STRONG_WEIGHT":2,"REPEAT_FACTOR":0.5}`. The sim config's
 * setup file applies them by mocking the modules that define the constants, so
 * no production code changes.
 *
 * This module must not import the constants modules: it is loaded by their mocks.
 */

/** The overridable constants that live in `@/lib/ranking/bt/constants`. */
export const BT_CONSTANTS = [
  'PAIR_WEIGHT',
  'STRONG_WEIGHT',
  'DRAW_WEIGHT_EACH_WAY',
  'PLACEMENT_SD_FRACTION',
  'REPEAT_FACTOR',
] as const;

/** Every constant a run may override. */
export const OVERRIDABLE: readonly string[] = [...BT_CONSTANTS];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Throws, naming the constant, if the value is not one the constant can take. */
function checkValue(name: string, value: unknown): void {
  if (!isFiniteNumber(value)) throw new Error(`SIM_OVERRIDES: ${name} must be a number`);
}

/**
 * Parses SIM_OVERRIDES. No text (unset or empty) is no overrides. Throws for
 * text that is not a JSON object, quoting the text, and for a key that is not
 * in OVERRIDABLE or a value of the wrong kind, naming the key, so that a typo
 * stops the run instead of running the defaults.
 */
export function parseOverrides(text: string | undefined): Record<string, unknown> {
  if (text === undefined || text.trim() === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`SIM_OVERRIDES is not JSON: ${text}`);
  }
  if (!isPlainObject(parsed)) throw new Error(`SIM_OVERRIDES is not a JSON object: ${text}`);
  for (const [name, value] of Object.entries(parsed)) {
    if (!OVERRIDABLE.includes(name)) {
      throw new Error(`SIM_OVERRIDES: ${name} is not an overridable constant (${OVERRIDABLE.join(', ')})`);
    }
    checkValue(name, value);
  }
  return parsed;
}

/**
 * A copy of a module's exports with the overrides whose names are in `names`
 * applied; every other export is the original. Throws for a name to apply that
 * the module does not export.
 */
export function withOverrides<T extends object>(
  original: T,
  overrides: Record<string, unknown>,
  names: readonly string[],
): T {
  const copy = { ...original } as Record<string, unknown>;
  for (const [name, value] of Object.entries(overrides)) {
    if (!names.includes(name)) continue;
    if (!(name in original)) throw new Error(`withOverrides: the module has no export ${name}`);
    copy[name] = value;
  }
  return copy as T;
}

/** The pickers a run may use: the engine's own, or the simpler one in tests/sim/pickers.ts. */
export const PICKERS = ['current', 'adjacent'] as const;

export type PickerName = (typeof PICKERS)[number];

/**
 * Parses SIM_PICKER. No text (unset or empty) is the engine's own picker.
 * Throws, naming the value, for anything that is not in PICKERS, so that a typo
 * stops the run instead of running the real picker.
 */
export function parsePicker(text: string | undefined): PickerName {
  if (text === undefined || text === '') return 'current';
  if (!(PICKERS as readonly string[]).includes(text)) {
    throw new Error(`SIM_PICKER: ${text} is not a picker (${PICKERS.join(', ')})`);
  }
  return text as PickerName;
}
