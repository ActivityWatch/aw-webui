import { getUnsupportedWorkReportHosts, getWorkReportHostOptions } from '~/util/workReport';

const buckets = [
  {
    id: 'aw-watcher-window_laptop',
    hostname: 'laptop',
    device_id: 'laptop',
    type: 'currentwindow',
    data: {},
  },
  {
    id: 'aw-watcher-afk_laptop',
    hostname: 'laptop',
    device_id: 'laptop',
    type: 'afkstatus',
    data: {},
  },
  {
    id: 'aw-watcher-window_phone',
    hostname: 'phone',
    device_id: 'phone',
    type: 'currentwindow',
    data: {},
  },
];

describe('workReport host helpers', () => {
  test('getWorkReportHostOptions disables hosts without AFK buckets', () => {
    expect(getWorkReportHostOptions(buckets as any)).toEqual([
      { value: 'laptop', text: 'laptop', disabled: false },
      { value: 'phone', text: 'phone (requires aw-watcher-afk)', disabled: true },
    ]);
  });

  test('getUnsupportedWorkReportHosts returns selected hosts missing AFK buckets', () => {
    expect(getUnsupportedWorkReportHosts(['laptop', 'phone'], buckets as any)).toEqual(['phone']);
  });
});
