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

// Components render in tests without a navigator, so every screen is the one
// in front; a test about hidden screens mocks this module itself.
vi.mock('@/lib/hooks/useScreenFocused', () => ({ useScreenFocused: () => true }));
