import { createLocalVue, shallowMount } from '@vue/test-utils';
import { createPinia, PiniaVuePlugin, setActivePinia } from 'pinia';
import Buckets from '~/views/Buckets.vue';
import asyncErrorCapturedMixin from '~/mixins/asyncErrorCaptured';
import { exportRangeQuery } from '~/util/export';

const mockDownloadBlob = jest.fn();
jest.mock('~/util/export', () => ({
  ...jest.requireActual('~/util/export'),
  downloadBlob: (...args) => mockDownloadBlob(...args),
  androidExportFromUrl: () => false,
}));
jest.mock('~/util/awclient', () => ({
  ...jest.requireActual('~/util/awclient'),
  getClient: () => ({ getBuckets: jest.fn().mockResolvedValue({}) }),
}));

const localVue = createLocalVue();
localVue.use(PiniaVuePlugin);
localVue.mixin(asyncErrorCapturedMixin);
const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));
const stubs = Object.fromEntries(
  [
    'b-card',
    'b-badge',
    'b-dropdown',
    'b-dropdown-item-button',
    'b-dropdown-item',
    'b-dropdown-divider',
    'b-modal',
    'b-button',
    'b-alert',
    'b-card-group',
    'b-form-file',
    'b-spinner',
    'icon',
    'router-link',
    'aw-devonly',
    'aw-bucket-merge',
    'aw-bucket-validate',
    'aw-export-dialog',
  ].map(name => [name, true])
);
const BUCKET = 'aw-watcher-window_host';
const range = exportRangeQuery('2026-10-26', '2026-10-30');
const suffix = '_2026-10-26_2026-10-30';
const chosen = { from: '2026-10-26', to: '2026-10-30' };

describe('Raw Data exports, through one dialog', () => {
  let wrapper, get, clicked;

  beforeEach(async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    get = jest.fn().mockResolvedValue({ data: new Blob(['{}']) });
    mockDownloadBlob.mockReset();
    clicked = [];
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      clicked.push({ href: this.href, download: this.download });
    });
    wrapper = shallowMount(Buckets, {
      localVue,
      pinia,
      stubs,
      mocks: {
        $t: key => key,
        $aw: { req: { get, defaults: { baseURL: 'http://127.0.0.1:5600/api' } } },
      },
    });
    await flushPromises();
    await wrapper.vm.bucketsStore.$patch({
      buckets: [{ id: BUCKET, hostname: 'host', type: 'currentwindow', data: {} }],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    wrapper.destroy();
  });

  const dialog = () => wrapper.find('aw-export-dialog-stub');
  const paths = () => get.mock.calls.map(([path]) => path);
  const files = () => mockDownloadBlob.mock.calls.map(([name]) => name);

  test('a bucket menu has one export entry, which opens the dialog for that bucket', async () => {
    const entries = wrapper
      .findAll('b-dropdown-item-stub')
      .filter(e => e.text().includes('buckets.exportBucket'));
    expect(entries.length).toBe(1);
    expect(wrapper.html()).not.toContain('buckets.exportBucketJson');
    expect(wrapper.html()).not.toContain('buckets.exportEventsCsv');
    entries.at(0).vm.$emit('click');
    await wrapper.vm.$nextTick();
    expect(dialog().props('visible')).toBe(true);
    expect(dialog().props('bucketId')).toBe(BUCKET);
  });

  test('"Export all buckets…" opens the same dialog, for all buckets', async () => {
    const button = wrapper
      .findAll('b-button-stub')
      .filter(b => b.attributes('title') === 'buckets.exportAll');
    button.at(0).vm.$emit('click');
    await wrapper.vm.$nextTick();
    expect(dialog().props('visible')).toBe(true);
    expect(dialog().props('bucketId')).toBeNull(); // all buckets
  });

  test('no range: the whole history, as before', async () => {
    wrapper.vm.open_export(BUCKET);
    await wrapper.vm.run_export({ format: 'json', from: '', to: '' });
    wrapper.vm.open_export(null);
    await wrapper.vm.run_export({ format: 'json', from: '', to: '' });
    expect(paths()).toEqual([`/0/buckets/${BUCKET}/export`, '/0/export']);
    expect(files()).toEqual([`aw-bucket-export-${BUCKET}.json`, 'aw-buckets-export.json']);
  });

  test('a bucket as JSON, a bucket as CSV, all buckets: each with the chosen range', async () => {
    wrapper.vm.open_export(BUCKET);
    await wrapper.vm.run_export({ format: 'json', ...chosen });
    wrapper.vm.open_export(BUCKET);
    await wrapper.vm.run_export({ format: 'csv', ...chosen });
    wrapper.vm.open_export(null);
    await wrapper.vm.run_export({ format: 'json', ...chosen });
    expect(paths()).toEqual([`/0/buckets/${BUCKET}/export${range}`, `/0/export${range}`]);
    expect(files()).toEqual([
      `aw-bucket-export-${BUCKET}${suffix}.json`,
      `aw-buckets-export${suffix}.json`,
    ]);
    // Without an API key, the CSV is a plain browser download of the ranged URL.
    expect(clicked).toEqual([
      {
        href: `http://127.0.0.1:5600/api/0/buckets/${BUCKET}/export/csv${range}`,
        download: `aw-events-export-${BUCKET}${suffix}.csv`,
      },
    ]);
  });

  test('exporting closes the dialog, which offers the same range next time', async () => {
    wrapper.vm.open_export(BUCKET);
    await wrapper.vm.run_export({ format: 'json', ...chosen });
    expect(wrapper.vm.export_dialog_open).toBe(false);
    wrapper.vm.open_export('another');
    await wrapper.vm.$nextTick();
    expect(dialog().props('initialFrom')).toBe(chosen.from);
    expect(dialog().props('initialTo')).toBe(chosen.to);
  });
});
