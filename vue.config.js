const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  pages: {
    index: {
      entry: './src/main.js',
      template: './src/index.html',
    },
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
