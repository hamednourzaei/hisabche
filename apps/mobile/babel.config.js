module.exports = function (api) {
  api.cache(true)
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    // react-native-reanimated/plugin must stay last
    plugins: ['react-native-reanimated/plugin'],
  }
}
