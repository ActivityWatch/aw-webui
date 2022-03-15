// Tests can be added in the aw-webui/test folder
// File names that end with .test.js will be run in the jsdom testEnvironment
// File names that end with .test.node.js will be run in the node testEnvironment

module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.{js,ts}'],
  projects: [
    {
      displayName: 'jsdom',
      preset: '@vue/cli-plugin-unit-jest',
      testEnvironment: 'jsdom',
      transform: {
        '^.+\\.js$': 'babel-jest',
        '^.+\\.ts$': 'ts-jest',
        '^.+\\.vue$': '@vue/vue2-jest',
      },
      testMatch: ['**/test/**/*.test.js?(x)'],
      moduleNameMapper: {
        '^~/(.+)$': '<rootDir>/src/$1',
      },
      moduleFileExtensions: ['js', 'ts', 'vue', 'json'],
      modulePathIgnorePatterns: ['test/e2e/screenshot.test.js'], // Don't run this file in npm test
    },
    {
      displayName: 'node',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['**/test/**/*.test.node.{js,ts}?(x)'],
      transform: {
        '^.+\\.js$': 'babel-jest',
        '^.+\\.ts$': 'ts-jest',
        '^.+\\.vue$': '@vue/vue2-jest',
      },
      moduleNameMapper: {
        '^~/(.+)$': '<rootDir>/src/$1',
      },
    },
  ],
};
