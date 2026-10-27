import { shallowMount } from '@vue/test-utils';
import Papa from 'papaparse';
import Buckets from '~/views/Buckets.vue';
import { androidExportFromUrl, downloadBlob } from '~/util/export';

jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({ bucketsByDevice: [], loadBuckets: jest.fn() }),
}));
jest.mock('~/stores/server', () => ({ useServerStore: () => ({}) }));
jest.mock('~/util/export', () => ({
  androidExportFromUrl: jest.fn(() => false),
  downloadBlob: jest.fn(),
}));

const fs = require('fs');
const path = require('path');

describe('Buckets.vue device ID label', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../src/views/Buckets.vue'), 'utf8');

  test('renders device.device_id, not the missing device.id field', () => {
    expect(src).toContain('device.device_id');
    expect(src).not.toContain('device.id');
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

describe('Buckets.vue bucket rows', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../src/views/Buckets.vue'), 'utf8');

  test('lists buckets as links with a content-sized timestamp, not a button table', () => {
    // A fixed-layout table gave the timestamp column a set width, wasting space
    // while bucket IDs were ellipsized; rows now flex around the timestamp.
    expect(src).not.toMatch(/b-table/);
    expect(src).toMatch(/router-link\.bucket-link\(:to="'\/buckets\/' \+ bucket\.id"/);
    expect(src).toMatch(/\.bucket-updated \{\s*flex: none;/);
    expect(src).toMatch(/\.bucket-id \{\s*flex: 1 1 auto;\s*min-width: 0;/);
  });
});

describe('Buckets.vue CSV date range', () => {
  let wrapper;
  let get;

  beforeEach(() => {
    jest.clearAllMocks();
    get = jest.fn().mockResolvedValue({ data: [] });
    wrapper = shallowMount(Buckets, {
      mocks: { $aw: { req: { get, defaults: { baseURL: '/api' } } } },
      stubs: [
        'b-modal',
        'b-form-group',
        'b-form-input',
        'b-alert',
        'b-card-group',
        'b-card',
        'b-form-file',
        'b-button',
        'icon',
        'aw-devonly',
        'aw-bucket-validate',
        'aw-bucket-merge',
      ],
    });
  });

  afterEach(() => wrapper.destroy());

  test.each([
    ['2026-10-20T09:00', '2026-10-20T17:00'],
    ['2026-10-20T09:00', ''],
    ['', '2026-10-20T17:00'],
  ])('passes local bounds %s / %s as UTC without limiting the event count', async (start, end) => {
    wrapper.vm.openExportCsvModal('bucket/a');
    await wrapper.setData({ export_start: start, export_end: end });
    await wrapper.vm.exportSelectedCsv({ preventDefault: jest.fn() });
    expect(get).toHaveBeenCalledWith('/0/buckets/bucket%2Fa/events', {
      params: {
        limit: -1,
        start: start ? new Date(start).toISOString() : undefined,
        end: end ? new Date(end).toISOString() : undefined,
      },
      timeout: 300_000,
    });
    expect(androidExportFromUrl).not.toHaveBeenCalled();
    expect(downloadBlob).toHaveBeenCalled();
  });

  test('blank bounds retain the existing full CSV download', async () => {
    (androidExportFromUrl as jest.Mock).mockReturnValueOnce(true);
    wrapper.vm.openExportCsvModal('bucket/a');
    await wrapper.vm.exportSelectedCsv({ preventDefault: jest.fn() });
    expect(androidExportFromUrl).toHaveBeenCalledWith(
      '/api/0/buckets/bucket%2Fa/export/csv',
      'aw-events-export-bucket/a.csv'
    );
    expect(get).not.toHaveBeenCalled();
  });

  test.each([
    ['2026-10-21T09:00', '2026-10-20T09:00'],
    ['invalid', ''],
  ])('blocks invalid bounds and keeps the modal open', async (start, end) => {
    wrapper.vm.openExportCsvModal('bucket');
    await wrapper.setData({ export_start: start, export_end: end });
    const preventDefault = jest.fn();
    await wrapper.vm.exportSelectedCsv({ preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  test('opening another bucket clears the previous selection without downloading', async () => {
    await wrapper.setData({ export_start: '2026-10-20T09:00', export_end: '2026-10-20T17:00' });
    wrapper.vm.openExportCsvModal('other');
    expect(wrapper.vm.export_bucket_selected).toBe('other');
    expect(wrapper.vm.export_start).toBe('');
    expect(wrapper.vm.export_end).toBe('');
    expect(get).not.toHaveBeenCalled();
  });

  test.each([
    { events: [] },
    {
      events: [
        { timestamp: '2026-10-20T08:00:00Z', duration: 60, data: { title: 'A, "quoted"\n title' } },
        { timestamp: '2026-10-20T07:00:00Z', duration: 30, data: { app: 'editor' } },
      ],
    },
  ])('exports a header even when empty and preserves all data columns', async ({ events }) => {
    get.mockResolvedValue({ data: events });
    await wrapper.vm.export_csv('bucket', '2026-10-20T00:00:00Z');
    const blob = (downloadBlob as jest.Mock).mock.calls[0][1];
    const csv = await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(blob);
    });
    const parsed = Papa.parse(csv, { header: true });
    expect(parsed.meta.fields).toEqual(
      events.length ? ['timestamp', 'duration', 'app', 'title'] : ['timestamp', 'duration']
    );
    if (events.length) expect(parsed.data[0].title).toBe(events[0].data.title);
  });

  test('preserves nested objects, arrays, and primitive CSV values', async () => {
    const data = {
      object: { value: 'original', nested: [1, { text: 'a, "quote"\nline' }] },
      array: ['a', { b: true }],
      emptyObject: {},
      emptyArray: [],
      nil: null,
      flag: false,
      zero: 0,
      text: 'plain',
    };
    get.mockResolvedValue({ data: [{ timestamp: '2026-10-20T08:00:00Z', duration: 60, data }] });
    await wrapper.vm.export_csv('bucket', '2026-10-20T00:00:00Z');
    const blob = (downloadBlob as jest.Mock).mock.calls[0][1];
    const csv = await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(blob);
    });
    const row = Papa.parse(csv, { header: true }).data[0];
    for (const key of ['object', 'array', 'emptyObject', 'emptyArray']) {
      expect(JSON.parse(row[key])).toEqual(data[key]);
    }
    expect(row).toMatchObject({ nil: '', flag: 'false', zero: '0', text: 'plain' });
  });

  test('reports request failures and clears the busy state', async () => {
    get.mockRejectedValue(new Error('offline'));
    const error = jest.spyOn(console, 'error').mockImplementation(jest.fn());
    await wrapper.vm.export_csv('bucket', '2026-10-20T00:00:00Z');
    expect(wrapper.vm.export_error).toContain('offline');
    expect(wrapper.vm.exporting).toBe(false);
    expect(downloadBlob).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
