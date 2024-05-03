import path from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue2';

export default defineConfig(({ mode }) => {
  const PRODUCTION = mode === 'production';

  return {
    server: {
      port: 27180,
      // This breaks a bunch of style-related stuff (at least):
      //headers: {
      //  'Content-Security-Policy': PRODUCTION ? "default-src 'self'" : "default-src 'self' *:5666",
      //},
    },
    plugins: [vue()],
    publicDir: './static',
    resolve: {
      alias: { '~': path.resolve(__dirname, 'src') },
    },
    define: {
      PRODUCTION,
      AW_SERVER_URL: process.env.AW_SERVER_URL,
      COMMIT_HASH: process.env.COMMIT_HASH,
      'process.env.VUE_APP_ON_ANDROID': process.env.VUE_APP_ON_ANDROID,
    },
  };
});
