import { defineConfig } from 'vitest/config';

export default defineConfig(() => {
  return {
    test: {
      // setupFiles: ['./src/macros.ts'],
      include: ['**/*.{test,spec,e2e-spec}.?(c|m)[jt]s?(x)'],
      silent: false,
    },
    resolve: {
      alias: {},
    },
  };
});
