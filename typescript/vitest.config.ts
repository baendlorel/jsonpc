import replace from '@rollup/plugin-replace';
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
    plugins: [
      (replace as unknown as typeof replace.default)({
        preventAssignment: true,
        delimiter: ['', ''],
        values: {
          __IS_DEV__: 'true',
          COMMENT_PREFIX: "'//'",
          '${COMMENT_PREFIX}': '//',
          SEP: '"\x1f"',
          '${SEP}': '\x1f',
        },
      }),
    ],
  };
});
