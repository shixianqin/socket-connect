const path = require('path')
const pkgName = 'socket'
const argv = JSON.parse(process.env.npm_config_argv)
const isMin = argv.cooked.indexOf('--min') >= 0

const libName = pkgName[0].toUpperCase() + pkgName.substr(1).replace(/-\w/g, (m) => {
  return m.substr(1).toUpperCase()
})

module.exports = {
  mode: 'production',
  entry: './src/index.ts',
  output: {
    filename: `${pkgName}${isMin ? '.min' : ''}.js`,
    path: path.resolve(__dirname, 'dist'),
    library: libName,
    libraryTarget: 'umd',
    libraryExport: 'default'
  },
  optimization: {
    minimize: isMin
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader'
      },
      {
        test: /\.js$/,
        loader: 'babel-loader'
      }
    ]
  }
}
