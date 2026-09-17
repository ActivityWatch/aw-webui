const fs = require('fs');
const path = require('path');

describe('Buckets.vue device ID label', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../src/views/Buckets.vue'), 'utf8');

  test('renders device.device_id, not the missing device.id field', () => {
    expect(src).toMatch(/ID: \{\{ device\.device_id \}\}/);
    expect(src).not.toMatch(/ID: \{\{ device\.id \}\}/);
  });
});
