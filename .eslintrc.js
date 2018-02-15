module.exports = {
  env: {
    browser: true,
    es6: true,
  },
  extends: ['plugin:prettier/recommended', 'plugin:vue/recommended'],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2017,
  },
  plugins: ['prettier'],
  rules: {
    'prettier/prettier': 'error',
  },
};
