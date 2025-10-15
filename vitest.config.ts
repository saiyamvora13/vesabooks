import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    // Use node environment for server tests, jsdom for client tests
    environment: 'node',
    setupFiles: ['./tests/server/setup.ts'],
    include: ['tests/**/*.test.ts', 'client/src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environmentMatchGlobs: [
      // Server tests use node environment
      ['tests/server/**', 'node'],
      // Client tests use jsdom environment
      ['client/src/**/*.test.{ts,tsx}', 'jsdom'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['server/**/*.ts', 'client/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/tests/**',
        '**/client/src/__tests__/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
      '@server': path.resolve(import.meta.dirname, 'server'),
    },
  },
});
