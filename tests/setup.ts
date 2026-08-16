import { afterEach } from 'vitest';

// Logic tests run in the node environment, component tests opt into jsdom with
// a `@vitest-environment jsdom` docblock; only the latter have a DOM to clean.
afterEach(async () => {
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});
