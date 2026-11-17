import moment from 'moment';
import { reportChartDatasets } from '~/util/reportChart';
import { exactBucketLabels } from '~/util/timeperiod';

const event = (timestamp: string, duration: number, path?: string[]) => ({
  timestamp,
  duration,
  data: { $category: path },
});

function period(start: string, end: string) {
  return { start, length: [moment(end).diff(moment(start)), 'milliseconds'] as [number, string] };
}

test('splits boundary-crossing events, keeps fractional hours and clips to the requested range', () => {
  const range = period('2026-10-01T12:15:00Z', '2026-10-01T13:45:00Z');
  const events = [
    event('2026-10-01T12:00:00Z', 1800, ['Work']),
    event('2026-10-01T13:00:00Z', 3600, ['Work']),
    event('2026-10-01T13:15:00Z', 1, ['Deleted', 'Child']),
  ];
  const before = JSON.stringify(events);
  const datasets = reportChartDatasets(events, range, []);
  expect(datasets[0].data).toEqual([0.5, 0.5]);
  expect(datasets[1].label).toBe('Deleted > Child');
  expect(datasets[1].data).toEqual([0, 1 / 3600]);
  expect(exactBucketLabels(range)).toHaveLength(2);
  expect(JSON.stringify(events)).toBe(before);
});

test('keeps distinct category paths and unclassified events without requiring current category definitions', () => {
  const range = period('2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z');
  const datasets = reportChartDatasets(
    [
      event('2026-10-01T12:00:00Z', 60, ['A>>>B']),
      event('2026-10-01T12:00:00Z', 120, ['A', 'B']),
      event('2026-10-01T12:00:00Z', 180),
    ],
    range,
    []
  );
  expect(datasets.map(d => d.label)).toEqual(['A>>>B', 'A > B', 'Uncategorized']);
  expect(datasets.map(d => d.data.reduce((a, b) => a + b, 0))).toEqual([1 / 60, 1 / 30, 0.05]);
  expect(reportChartDatasets([], range, [])).toEqual([]);
});

test('calendar day buckets and chart labels cover the same DST interval', () => {
  // Run under Europe/Stockholm as well as UTC: both must conserve duration.
  const range = period('2026-10-24T00:00:00+02:00', '2026-10-27T00:00:00+01:00');
  const seconds = range.length[0] / 1000;
  const dataset = reportChartDatasets([event(range.start, seconds, ['Work'])], range, [])[0];
  expect(dataset.data).toHaveLength(exactBucketLabels(range).length);
  expect(dataset.data.reduce((a, b) => a + b, 0)).toBe(73);
});
