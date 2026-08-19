/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-mock-key';
process.env.SQLITE_PATH = ':memory:';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
  ssr: {
    external: ['node:sqlite'],
  },
});
