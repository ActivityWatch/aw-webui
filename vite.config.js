import path from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

// Stub plugin for Vue 2-only packages that can't be resolved yet.
// This lets the build proceed so we can see all component-level errors.
// TODO(vue3-migration): Replace these stubs with real Vue 3 alternatives.
const vue2StubPlugin = () => {
  const stubIds = [
    // vue-awesome: Vue 2 icon library — stub all icon imports and the main component
    /^vue-awesome(\/.*)?$/,
    // vue-color: Vue 2 color picker — needs replacement (e.g. vue3-colorpicker)
    /^vue-color(\/.*)?$/,
    // vue-datetime: Vue 2 datetime picker — needs replacement (e.g. vue-datepicker-next)
    /^vue-datetime(\/.*)?$/,
    // vue-d3-sunburst: may or may not work with Vue 3; stub for now
    /^vue-d3-sunburst(\/.*)?$/,
  ];

  return {
    name: 'vue2-stub',
    resolveId(id) {
      if (stubIds.some(re => re.test(id))) {
        return '\0vue2-stub:' + id;
      }
    },
    load(id) {
      if (id.startsWith('\0vue2-stub:')) {
        // For CSS imports: return empty string
        if (id.endsWith('.css')) {
          return '';
        }
        // For icon side-effect imports (vue-awesome/icons/*): no-op
        // For component imports: export a stub component
        return `
import { defineComponent, h } from 'vue';
const Stub = defineComponent({
  name: 'Vue2Stub',
  props: { name: String, scale: [Number, String] },
  render() { return h('span', { 'data-stub': true }); },
});
export default Stub;
export const Compact = Stub;
export const Sketch = Stub;
export const Chrome = Stub;
export const Datetime = Stub;
export { Stub as Icon };
`;
      }
    },
  };
};

export default defineConfig(({ mode }) => {
  const PRODUCTION = mode === 'production';
  const CSP = PRODUCTION ? '' : '*:5600 *:5666 ws://*:27180';

  // Sets the CSP
  const setCsp = () => {
    return {
      name: 'html-transform',
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
      name: 'html-transform',
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
    plugins: [
      vue2StubPlugin(),
      setCsp(),
      autoInject(),
      vue({
        // Disable asset URL transformation so that runtime-provided assets
        // (like /logo.png served by aw-server) are not treated as build-time imports.
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
      'process.env.VUE_APP_ON_ANDROID': process.env.VUE_APP_ON_ANDROID,
    },
  };
});
