import { hostDurationBreakdown } from '~/util/multidevice';
import { mergeFullDesktopResults } from '~/util/desktopQuerySplit';
import { multideviceQuery } from '~/queries';

describe('hostDurationBreakdown', () => {
  test('credited shares add up to the merged total', () => {
    // desktop 5h, phone 3h of which 1h overlaps the desktop
    const out = hostDurationBreakdown(
      ['desktop', 'phone'],
      [5 * 3600, 7 * 3600],
      [5 * 3600, 3 * 3600]
    );
    expect(out).toEqual([
      { host: 'desktop', duration: 5 * 3600, overlap: 0 },
      { host: 'phone', duration: 2 * 3600, overlap: 3600 },
    ]);
    expect(out[0].duration + out[1].duration).toBe(7 * 3600);
  });

  test('returns nothing when the durations do not match the hosts', () => {
    expect(hostDurationBreakdown(['a', 'b'], undefined, undefined)).toEqual([]);
    expect(hostDurationBreakdown(['a', 'b'], [1], [1])).toEqual([]);
  });
});

test('period chunks sum per-host durations element-wise', () => {
  const merged = mergeFullDesktopResults([
    { window: { host_cumulative_durations: [10, 15], host_raw_durations: [10, 8] } },
    { window: { host_cumulative_durations: [4, 6], host_raw_durations: [4, 2] } },
  ] as any);
  expect(merged.window.host_cumulative_durations).toEqual([14, 21]);
  expect(merged.window.host_raw_durations).toEqual([14, 10]);
});

test('multideviceQuery returns cumulative and raw per-host durations', () => {
  const q = multideviceQuery({
    bid_window: 'aw-watcher-window_a',
    bid_afk: 'aw-watcher-afk_a',
    classes: [],
    filter_classes: [],
    filter_afk: true,
    hosts: ['a', 'b'],
    host_params: {},
  } as any).join('\n');
  expect(q).toContain('host_cumulative_1 = sum_durations(events);');
  expect(q).toContain('"host_cumulative_durations": [host_cumulative_0, host_cumulative_1]');
  expect(q).toContain('"host_raw_durations": [host_raw_0, host_raw_1]');
});
