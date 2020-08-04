// Tests can be added in the aw-webui/test folder
// File names that end with .test.js will be run in the jsdom testEnvironment
// File names that end with .test.node.js will be run in the node testEnvironment

module.exports = {
  projects: [
    {
      displayName: 'jsdom',
      preset: '@vue/cli-plugin-unit-jest',
      testEnvironment: 'jsdom',
      transform: {
        '^.+\\.js$': 'babel-jest',
        '^.+\\.vue$': 'vue-jest'
      },
      testMatch: ['**/test/**/*.test.js?(x)']
    },
    {
      displayName: 'node',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['**/test/**/*.test.node.js?(x)'],
    }
  ],
};