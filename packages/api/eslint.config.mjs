// .eslintrc.js
module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended', // ✅ باید باشد
    'next/core-web-vitals',
    'prettier',
  ],
  parser: '@typescript-eslint/parser', // ✅ باید باشد
  parserOptions: {
    project: './tsconfig.json', // ✅ باید باشد
    tsconfigRootDir: __dirname,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'], // ✅ باید باشد
  rules: {
    // قوانین شما
  },
  ignorePatterns: ['node_modules', '.next', 'dist', 'build'],
}