var path = require('path');
var webpack = require('webpack');
var CopyPlugin = require('copy-webpack-plugin');


module.exports = {
  mode: 'development',
  entry: {
    app: __dirname + '/lib/public/src/App'
  },
  output: {
    path: __dirname + '/lib/public/js',
    filename: '[name].js'
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs']
  },
  
  optimization: {
    minimize: false
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/public/index.html', to: '../index.html' },
        { from: 'src/public/css/styles.css', to: '../css/styles.css' }
      ]
    })
  ]
};