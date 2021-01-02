const plugins = ['lodash', '@babel/plugin-syntax-dynamic-import'];
if (process.env.NODE_ENV === 'test') {
  plugins.push([
    'babel-plugin-istanbul',
    {
      // specify some options for NYC instrumentation here
      // like tell it to instrument both JavaScript and Vue files
      extension: ['.js', '.ts', '.vue'],
    },
  ]);
}

module.exports = {
  // TODO: We should try to switch to the @vue/app preset, but right now it breaks everything
  //presets: ['@vue/app'],
  presets: ['@vue/cli-plugin-babel/preset'],
  plugins: plugins,
  comments: false,
};
