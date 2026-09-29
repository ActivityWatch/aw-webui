import path from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const PRODUCTION = mode === 'production';
  const CSP = PRODUCTION ? '' : '*:5600 *:5666 ws://*:27180';

  // Sets the CSP
  const setCsp = () => {
    return {
      name: 'set-csp',
      transformIndexHtml(html) {
        const pattern = '<%= htmlWebpackPlugin.options.templateParameters.cspDefaultSrc %>';
        // check if the pattern exists in the html, if not, throw error
        if (!html.includes(pattern)) {
          throw new Error(`Could not find pattern ${pattern} in the html file`);
        }
        return html.replace(pattern, CSP);
      },
    };
  };

  // Auto-injects /src/main.js into index.html on a new line after the one which has VITE_AUTOINJECT
  const autoInject = () => {
    return {
      name: 'auto-inject',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          const pattern = /<!--.*VITE_AUTOINJECT.*-->/;
          // check if the pattern exists in the html, if not, throw error
          if (!pattern.test(html)) {
            throw new Error(`Could not find pattern ${pattern} in the html file`);
          }
          return html.replace(
            pattern,
            '<!-- Vite injected! --><script type="module" src="/src/main.js"></script>'
          );
        },
      },
    };
  };

  // Return the configuration
  return {
    build: {
      // Temporary compat knob for #867/#869: the forced esbuild 0.28.x security
      // upgrade cannot lower one destructuring pattern to the old default targets.
      // Drop this once Vite can consume a patched esbuild line without overrides.
      target: 'es2022',
    },
    plugins: [
      setCsp(),
      autoInject(),
      vue({
        // Disable asset URL transformation — the logo is served at runtime by aw-server,
        // not bundled at build time. Using a targeted allowlist (Greptile suggestion)
        // doesn't work because /logo.png is an absolute runtime path, not a local asset.
        template: {
          transformAssetUrls: false,
        },
      }),
      VitePWA({
        devOptions: {
          enabled: true,
        },
        // NOTE: logo.png is gitignored — it is copied from the aw-media package at release build
        // time. The PWA manifest references it but it doesn't need to be present during dev builds.
        manifest: {
          name: 'ActivityWatch',
          short_name: 'ActivityWatch',
          description: 'Automatically track your computer usage',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'logo.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
        // Don't fail the build if the logo isn't present (it's provided at runtime by aw-media)
        includeAssets: [],
      }),
    ],
    server: {
      host: '127.0.0.1',
      port: 27180,
      // TODO: Fix this.
      // Breaks a bunch of style-related stuff etc.
      // We'd need to move in the entire CSP config in here (not just the default-src) if we want to use this.
      //headers: {
      //  'Content-Security-Policy': PRODUCTION ? "default-src 'self'" : "default-src 'self' *:5666",
      //},
    },
    publicDir: './static',
    resolve: {
      alias: { '~': path.resolve(__dirname, 'src') },
    },
    define: {
      PRODUCTION,
      AW_SERVER_URL: process.env.AW_SERVER_URL,
      COMMIT_HASH: process.env.COMMIT_HASH,
      AW_RESEARCH_EDITION: process.env.AW_RESEARCH_EDITION === 'true',
      // Optional JSON preset category sets shipped by this build (see src/util/presetCategories.ts)
      AW_PRESET_CATEGORY_SETS: JSON.stringify(process.env.AW_PRESET_CATEGORY_SETS || ''),
      'process.env.VUE_APP_ON_ANDROID': process.env.VUE_APP_ON_ANDROID,
    },
  };
});
