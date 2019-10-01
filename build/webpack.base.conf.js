var path = require('path');
var config = require('../config');
var utils = require('./utils');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const VueLoaderPlugin = require('vue-loader/lib/plugin');

// Cleans up log spam from mini-css-extract-plugin and the like.
// Based on: https://github.com/webpack-contrib/mini-css-extract-plugin/issues/168#issuecomment-420095982
class CleanUpStatsPlugin {
  constructor(name) {
    this.name = name;
  }

  shouldPickStatChild(child) {
    return child.name.indexOf(this.name) !== 0;
  }

  apply(compiler) {
    compiler.hooks.done.tap('CleanUpStatsPlugin', stats => {
      const children = stats.compilation.children;
      if (Array.isArray(children)) {
        // eslint-disable-next-line no-param-reassign
        stats.compilation.children = children.filter(child => this.shouldPickStatChild(child));
      }
    });
  }
}

module.exports = {
  entry: {
    app: './src/main.js',
  },

  output: {
    path: config.build.assetsRoot,
    publicPath: config.build.assetsPublicPath,
    filename: '[name].js',
  },

  resolve: {
    extensions: ['.js', '.vue'],
    alias: {
      '~': path.resolve(__dirname, '../src'),
      src: path.resolve(__dirname, '../src'),
      assets: path.resolve(__dirname, '../src/assets'),
      components: path.resolve(__dirname, '../src/components'),
    },
  },

  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].css',
      chunkFilename: '[id].css',
    }),
    new VueLoaderPlugin(),
    new CleanUpStatsPlugin('mini-css-extract-plugin'),
    new CleanUpStatsPlugin('html-webpack-plugin'),
  ],

  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: {
          loaders: {
            js: 'babel-loader',
          },
        },
      },
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: [
          {
            loader: 'babel-loader',
            options: { presets: ['@babel/preset-env'] },
          },
        ],
      },
      {
        test: /\.pug$/,
        loader: 'pug-plain-loader',
      },
      {
        test: /\.json$/,
        loader: 'json',
      },
      {
        test: /\.html$/,
        loader: 'html-loader',
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.scss$/,
        use: [
          {
            loader: 'style-loader', // creates style nodes from JS strings
          },
          {
            loader: 'css-loader', // translates CSS into CommonJS
          },
          {
            loader: 'sass-loader', // compiles Sass to CSS
          },
        ],
      },
      {
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        loader: 'url-loader',
        query: {
          limit: 10000,
          name: utils.assetsPath('img/[name].[hash:7].[ext]'),
        },
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        loader: 'url-loader',
        query: {
          limit: 10000,
          name: utils.assetsPath('fonts/[name].[hash:7].[ext]'),
        },
      },
    ],
  },
};
