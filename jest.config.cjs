// Tests can be added in the aw-webui/test folder
// File names that end with .test.js will be run in the jsdom testEnvironment
// File names that end with .test.node.js will be run in the node testEnvironment

// Match @vitejs/plugin-vue: compile pug with the html doctype so that valueless
// attributes (e.g. `template(#header)`, `v-else`) aren't expanded to `attr="attr"`.
const vueJestGlobals = { 'vue-jest': { pug: { doctype: 'html' } } };

module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.{js,ts}'],
  projects: [
    {
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      globals: vueJestGlobals,
      testEnvironmentOptions: {
        customExportConditions: ['node', 'node-addons'],
      },
      transform: {
        '^.+\\.js$': 'babel-jest',
        '^.+\\.ts$': 'ts-jest',
        '^.+\\.vue$': '@vue/vue3-jest',
      },
      transformIgnorePatterns: ['/node_modules/(?!(@ckpack/vue-color)/)'],
      testMatch: ['**/test/**/*.test.js?(x)'],
      moduleNameMapper: {
        '^~/(.+)$': '<rootDir>/src/$1',
        '^d3$': '<rootDir>/node_modules/d3/dist/d3.min.js',
      },
      moduleFileExtensions: ['js', 'ts', 'vue', 'json'],
      modulePathIgnorePatterns: ['test/e2e/screenshot.test.js'], // Don't run this file in npm test
    },
    {
      displayName: 'node',
      preset: 'ts-jest',
      testEnvironment: 'node',
      globals: vueJestGlobals,
      testMatch: ['**/test/**/*.test.node.{js,ts}?(x)'],
      transform: {
        '^.+\\.js$': 'babel-jest',
        '^.+\\.ts$': 'ts-jest',
        '^.+\\.vue$': '@vue/vue3-jest',
      },
      transformIgnorePatterns: ['/node_modules/(?!(@ckpack/vue-color)/)'],
      moduleNameMapper: {
        '^~/(.+)$': '<rootDir>/src/$1',
        '^d3$': '<rootDir>/node_modules/d3/dist/d3.min',
      },
    },
  ],
};
