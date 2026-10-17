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
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
    globals: false,
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
