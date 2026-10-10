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

describe('Buckets.vue bucket import', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../src/views/Buckets.vue'), 'utf8');

  test('shows a success alert and the server error message in the import card', () => {
    expect(src).toMatch(/import_success/);
    expect(src).toMatch(/buckets\.importSuccess/);
    expect(src).toMatch(/response\?\.data\?\.message/);
  });

  test('clears the previous outcome before a new import starts', () => {
    // A new import must not render the previous run's success/error alert
    // beside the importing spinner.
    expect(src).toMatch(
      /this\.import_success = false;\s*\n\s*this\.import_error = null;\s*\n\s*try \{/
    );
  });

  test('issues the import outside component methods', () => {
    // asyncErrorCapturedMixin wraps every async component method so its
    // rejection is reported to the global ErrorBoundary and the promise it
    // returns resolves. A wrapped importBuckets would therefore never reject
    // in the watcher's catch, and a failed import would still look successful.
    expect(src).not.toMatch(/importBuckets:\s*async function/);
    expect(src).toMatch(/await importBuckets\(this\.\$aw/);
  });
});
