import path from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue2';

export default defineConfig({
  plugins: [vue()],
  publicDir: './static',
  resolve: {
    alias: { '/src': path.resolve(process.cwd(), 'src') },
  },
});
