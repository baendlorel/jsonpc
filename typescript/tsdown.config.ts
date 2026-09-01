import { join } from 'node:path';
import { defineConfig } from 'tsdown';
import replace from '@rollup/plugin-replace';

const isDev = !process.argv.includes('--env.production');
console.log('当前环境:', isDev ? '开发环境' : '生产环境');

export const replacePlugin = () =>
  (replace as unknown as typeof replace.default)({
    preventAssignment: true,
    delimiter: ['', ''],
    values: {
      __IS_DEV__: isDev ? 'true' : 'false',
      COMMENT_PREFIX: "'//'",
      '${COMMENT_PREFIX}': '//',
      SEP: '"\uE000"',
      '${SEP}': '\uE000',
    },
  });

export default defineConfig({
  cwd: import.meta.dirname,
  entry: [join(import.meta.dirname, 'src', 'index.ts')],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: true,
  target: 'node16',
  treeshake: true,
  plugins: [replacePlugin()],
  deps: {
    alwaysBundle: ['reflect-deep'],
  },
});
