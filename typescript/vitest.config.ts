import { defineConfig } from 'vitest/config';
import { replacePlugin } from './tsdown.config.js';

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
    plugins: [replacePlugin()],
  };
});
