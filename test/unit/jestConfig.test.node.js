const config = require('../../jest.config.cjs');

test('bounds the default worker pool independently of host CPU count', () => {
  expect(config.maxWorkers).toBe(2);
});
