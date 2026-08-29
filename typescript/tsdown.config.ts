import { join } from 'node:path';
import { defineConfig } from 'tsdown';
import replace from '@rollup/plugin-replace';

const isDev = process.env.NODE_ENV === 'development';

export default defineConfig({
  cwd: import.meta.dirname,
  entry: [join(import.meta.dirname, 'src', 'index.ts')],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: !isDev,
  target: 'node16',
  treeshake: !isDev,
  plugins: [
    (replace as unknown as typeof replace.default)({
      preventAssignment: true,
      delimiter: ['', ''],
      values: {
        __IS_DEV__: isDev ? 'true' : 'false',
        COMMENT_PREFIX: "'//'",
        '${COMMENT_PREFIX}': '//',
      },
    }),
  ],
  deps: {
    onlyBundle: ['type-narrow'],
  },
});
