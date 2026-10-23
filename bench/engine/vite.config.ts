import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

/** Builds the benchmark page on its own; it is not part of the app or `npm test`. */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  resolve: { alias: { '@': repoRoot } },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
});
