import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Components are written against React Native and run on the web build,
      // so tests render them through react-native-web exactly as the app does.
      'react-native': 'react-native-web',
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  define: {
    __DEV__: 'false',
  },
  benchmark: { include: ['bench/**/*.bench.ts'] },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
    globals: false,
    // The ranking engine's simulation tests keep every core busy while the
    // UI integration tests run beside them, and the slowest of those take
    // about 2 s on a quiet machine. The 5 s default left too little room: one
    // run on 2026-10-17 had a failure that could not be reproduced, most
    // likely such a timeout.
    testTimeout: 15_000,
    // Node 25 turns on its own localStorage, which shadows the one each jsdom
    // test sets up. Set here rather than in NODE_OPTIONS so the scripts run
    // the same in every shell, Windows included.
    execArgv: ['--no-experimental-webstorage'],
    coverage: {
      provider: 'v8',
      reportOnFailure: true,
    },
  },
});
