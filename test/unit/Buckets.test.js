const fs = require('fs');
const path = require('path');

describe('Buckets.vue device ID label', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../src/views/Buckets.vue'), 'utf8');

  test('renders device.device_id, not the missing device.id field', () => {
    expect(src).toMatch(/ID: \{\{ device\.device_id \}\}/);
    expect(src).not.toMatch(/ID: \{\{ device\.id \}\}/);
  });
});

describe('Buckets.vue JSON export', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../src/views/Buckets.vue'), 'utf8');

  test('does not parse or pretty-print large export JSON in the WebView', () => {
    expect(src).toMatch(/responseType:\s*'blob'/);
    expect(src).toMatch(/timeout:\s*300_000/);
    expect(src).not.toMatch(/timeout:\s*0/);
    expect(src).toMatch(/androidExportFromUrl/);
    expect(src).toMatch(/this\.\$aw\.req\.get/);
    expect(src).not.toMatch(/JSON\.stringify\(response\.data/);
    expect(src).not.toMatch(/await fetch\(/);
  });
});

describe('Buckets.vue CSV export', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../src/views/Buckets.vue'), 'utf8');

  test('streams unauthenticated browser downloads and authenticates otherwise', () => {
    expect(src).toMatch(/export\/csv/);
    expect(src).toMatch(/androidExportFromUrl/);
    expect(src).toMatch(/getStoredApiToken/);
    expect(src).toMatch(/link\.click\(\)/);
    expect(src).toMatch(/responseType:\s*'blob'/);
    expect(src).not.toMatch(/Papa/);
    expect(src).not.toMatch(/timeout:\s*0/);
  });
});
