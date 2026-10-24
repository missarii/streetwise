import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/services/**', 'src/validators/**'],
    },
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
});
