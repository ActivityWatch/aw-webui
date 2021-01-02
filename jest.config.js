// Tests can be added in the aw-webui/tests folder
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
        '^.+\\.vue$': 'vue-jest',
      },
      testMatch: ['**/tests/unit/**/*.test.js?(x)'],
      moduleNameMapper: {
        '^~/(.+)$': '<rootDir>/src/$1',
      },
      //modulePathIgnorePatterns: ['tests/e2e/screenshot.test.js'], // Don't run this file in npm test
    },
    {
      displayName: 'node',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['**/tests/unit/**/*.test.node.js?(x)'],
      moduleNameMapper: {
        '^~/(.+)$': '<rootDir>/src/$1',
      },
    },
  ],
};
