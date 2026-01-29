import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Match Vite/TS `@` alias used across the codebase
      '@': path.resolve(__dirname),
    },
  },
  test: {
    globals: true,
    environment: 'node', // Changed from jsdom to node for now
  },
});
