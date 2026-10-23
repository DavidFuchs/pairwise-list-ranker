import { vi } from 'vitest';

import { parseOverrides, parsePicker } from '@/tests/sim/overrides';

// Parsed here, before any test file loads, so that an override that does not
// parse or names an unknown constant, or an unknown picker, stops the run with
// that name.
parseOverrides(process.env.SIM_OVERRIDES);
parsePicker(process.env.SIM_PICKER);

// Mocks registered in a setup file apply to every test file the sim config
// runs, and so to the engine modules those files import. The factories load
// the overrides module themselves: they run while the engine's imports are
// still loading, which may be before this file's own imports are ready.
vi.mock('@/lib/ranking/bt/constants', async (original) => {
  const { BT_CONSTANTS, parseOverrides: parse, withOverrides } = await import('@/tests/sim/overrides');
  return withOverrides(await original(), parse(process.env.SIM_OVERRIDES), BT_CONSTANTS);
});

// SIM_PICKER=adjacent puts the simpler picker of tests/sim/pickers.ts in the
// engine's place; pairKey and the rest stay the real module's. Any other value
// returns the real module itself, so the default run is unchanged.
//
// The factory cannot load tests/sim/pickers.ts itself: that module imports
// pairKey from the module being mocked, and waiting on it inside the factory
// never finishes. So the factory hands out stand-ins that call whatever picker
// this file loads below, once the mock exists.
const seam = vi.hoisted(() => ({
  adjacent: null as null | typeof import('@/tests/sim/pickers').adjacentPicker,
}));
vi.mock('@/lib/ranking/bt/picker', async (original) => {
  const { parsePicker: parse } = await import('@/tests/sim/overrides');
  const real = await original<typeof import('@/lib/ranking/bt/picker')>();
  if (parse(process.env.SIM_PICKER) !== 'adjacent') return real;
  const adjacent = () => {
    if (!seam.adjacent) throw new Error('SIM_PICKER=adjacent: the adjacent picker is not loaded yet');
    return seam.adjacent;
  };
  return {
    ...real,
    pickPair: (input: Parameters<typeof real.pickPair>[0]) => adjacent().pickPair(input),
  };
});
if (parsePicker(process.env.SIM_PICKER) === 'adjacent') {
  seam.adjacent = (await import('@/tests/sim/pickers')).adjacentPicker;
}
