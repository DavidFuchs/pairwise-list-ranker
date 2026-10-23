import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The long simulation runs (`npm run sim`): only `*.sim.ts` files, no time
// limits, and the SIM_OVERRIDES constant mocks from tests/sim/setup.ts. The
// resolve, define and execArgv settings are vitest.config.mts's, so the
// engine loads here exactly as it does in the CI tests.
export default defineConfig({
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  define: {
    __DEV__: 'false',
  },
  test: {
    environment: 'node',
    include: ['tests/sim/**/*.sim.ts'],
    setupFiles: ['tests/setup.ts', 'tests/sim/setup.ts'],
    globals: false,
    testTimeout: 0,
    hookTimeout: 0,
    execArgv: ['--no-experimental-webstorage'],
  },
});
