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
  sourcemap: false, // 关闭sourcemap减少体积
  minify: true, // 始终minify
  target: 'node16',
  treeshake: true, // 始终启用tree-shaking
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
    onlyBundle: ['reflect-deep'],
  },
});
