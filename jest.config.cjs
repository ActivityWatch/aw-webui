// Tests can be added in the aw-webui/test folder
// File names that end with .test.ts will be run in the jsdom testEnvironment
// File names that end with .test.node.ts will be run in the node testEnvironment

module.exports = {
  // CPU-derived defaults overcommit memory in containers on high-core hosts.
  // Keep a bounded default; developers can still override it with --maxWorkers.
  maxWorkers: 2,
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.{js,ts}'],
  projects: [
    {
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/test/jest-setup.js'],
      testEnvironmentOptions: {
        customExportConditions: ['node', 'node-addons'],
      },
      transform: {
        '^.+\\.js$': 'babel-jest',
        '^.+\\.ts$': 'ts-jest',
        '^.+\\.vue$': '@vue/vue3-jest',
      },
      transformIgnorePatterns: ['/node_modules/(?!(vue-awesome)/)'],
      testMatch: ['**/test/**/*.test.{js,ts}?(x)'],
      moduleNameMapper: {
        '^~/(.+)$': '<rootDir>/src/$1',
        '^d3$': '<rootDir>/node_modules/d3/dist/d3.min.js',
      },
      moduleFileExtensions: ['js', 'ts', 'vue', 'json'],
      modulePathIgnorePatterns: ['test/e2e/screenshot.test.ts'], // Don't run this file in npm test
    },
    {
      displayName: 'node',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['**/test/**/*.test.node.{js,ts}?(x)'],
      transform: {
        '^.+\\.js$': 'babel-jest',
        '^.+\\.ts$': 'ts-jest',
        '^.+\\.vue$': '@vue/vue3-jest',
      },
      transformIgnorePatterns: ['/node_modules/(?!(vue-awesome)/)'],
      moduleNameMapper: {
        '^~/(.+)$': '<rootDir>/src/$1',
        '^d3$': '<rootDir>/node_modules/d3/dist/d3.min',
      },
    },
  ],
};
