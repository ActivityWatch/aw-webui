module.exports = {
  'extends': [
    'airbnb-base',
    'plugin:vue/recommended'
  ],
  'globals': {
    'PRODUCTION': true
  },
  'settings': {
    'import/resolver': {
      'node': {
        'extensions': [
          '.js',
          '.jsx',
          '.vue'
        ]
      }
    }
  }
};