module.exports = {
  // TODO: We should try to switch to the @vue/app preset, but right now it breaks everything
  //presets: ['@vue/app'],
  presets: ['@vue/cli-plugin-babel/preset'],
  plugins: ['lodash', '@babel/plugin-syntax-dynamic-import'],
  comments: false,
};
