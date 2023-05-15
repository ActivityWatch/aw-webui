const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { argv } = require('yargs');

// get git info from command line
const _COMMIT_HASH = require('child_process')
  .execSync('git rev-parse --short HEAD')
  .toString()
  .trim();
console.info('Commit hash:', _COMMIT_HASH);

module.exports = {
  pages: {
    index: {
      entry: './src/main.js',
      template: './src/index.html',
    },
  },
  chainWebpack: config => {
    config.plugin('define').tap(options => {
      options[0]['process.env'].VUE_APP_ON_ANDROID = argv.os == 'android';
      return options;
    });
  },
  configureWebpack: {
    // sourcemaps are not enabled when `--watch` is used https://github.com/vuejs/vue-cli/issues/1806#issuecomment-832111894
    devtool: 'source-map',
    resolve: {
      alias: {
        '~': path.resolve(__dirname, './src'),
        src: path.resolve(__dirname, './src'),
        assets: path.resolve(__dirname, './src/assets'),
        components: path.resolve(__dirname, './src/components'),
      },
      fallback: {
        domain: require.resolve('domain-browser'),
      },
    },
    plugins: [
      new webpack.IgnorePlugin({ resourceRegExp: /^\.\/locale$/, contextRegExp: /moment$/ }),
      new webpack.DefinePlugin({
        AW_SERVER_URL: process.env.AW_SERVER_URL,
        PRODUCTION: process.env.NODE_ENV === 'production',
        COMMIT_HASH: JSON.stringify(_COMMIT_HASH),
      }),
      new CopyWebpackPlugin([{ from: 'static/', to: 'static' }]),
    ],
  },
  devServer: {
    compress: true,
    port: 27180,
    static: {
      directory: path.join(__dirname, 'dist'),
    },
  },
  pwa: {
    name: 'ActivityWatch',
    iconPaths: {
      faviconSVG: null, // SVG won't render without needed fonts etc, so fall back to png
      favicon32: 'static/logo.png',
      favicon16: 'static/logo.png',
      appleTouchIcon: 'static/logo.png',
      //maskIcon: 'static/logo.png',
      msTileImage: 'static/logo.png',
    },
    manifestOptions: {
      icons: [
        {
          src: 'static/logo.png',
          sizes: '512x512',
          type: 'image/png',
        },
      ],
    },
  },
  pluginOptions: {},
  transpileDependencies: [
    // can be string or regex
    'vis-data',
    'vis-timeline',
  ],
};
