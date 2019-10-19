const path = require('path');
const webpack = require('webpack');
const webpack_base_conf = require('./build/webpack.base.conf.js');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  pages: {
    index: {
      entry: './src/main.js',
      template: './src/index.html',
    },
  },
  configureWebpack: {
    resolve: { alias: webpack_base_conf.resolve.alias },
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
  pluginOptions: {
    webpackBundleAnalyzer: {
      openAnalyzer: false,
    },
  },
};
