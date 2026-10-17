import { afterEach, vi } from 'vitest';

// expo-router/head pulls in React Native source the test runner cannot parse.
// Page titles are checked against the real build in the end-to-end suite.
vi.mock('expo-router/head', () => ({ default: () => null }));

// Logic tests run in the node environment, component tests opt into jsdom with
// a `@vitest-environment jsdom` docblock; only the latter have a DOM to clean.
afterEach(async () => {
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});
