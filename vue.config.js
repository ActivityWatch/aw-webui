const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { argv } = require('yargs');

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
    })
 },
  configureWebpack: {
    resolve: {
      alias: {
        '~': path.resolve(__dirname, './src'),
        src: path.resolve(__dirname, './src'),
        assets: path.resolve(__dirname, './src/assets'),
        components: path.resolve(__dirname, './src/components'),
      },
    },
    plugins: [
      new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
      new webpack.DefinePlugin({
        PRODUCTION: process.env.NODE_ENV === 'production',
      }),
      new CopyWebpackPlugin([{ from: 'static/', to: 'static' }]),
    ],
  },
  devServer: {
    contentBase: path.join(__dirname, 'dist'),
    compress: true,
    port: 27180,
  },
  pwa: {
    name: 'ActivityWatch',
    iconPaths: {
      favicon32: 'static/logo.png',
      favicon16: 'static/logo.png',
    },
  },
  pluginOptions: {
    webpackBundleAnalyzer: {
      openAnalyzer: false,
      analyzerPort: 11000,
    },
  },
};
