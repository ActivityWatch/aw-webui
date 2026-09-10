import { buildBarchartDataset } from '~/util/datasets';
import { Category } from '~/util/classes';
import { IEvent } from '~/util/interfaces';

const event = (path: string[] | undefined, duration: number): IEvent => ({
  timestamp: '2026-09-10T10:00:00Z',
  duration,
  data: { $category: path },
});

test('preserves missing paths, distinct separator-containing paths, and every period duration', () => {
  const classes: Category[] = [
    { name: ['Known'], rule: { type: 'none' }, data: { color: '#123456' } },
    { name: ['Known', 'Child'], rule: { type: 'none' } },
  ];
  const periods = [
    {
      cat_events: [
        event(['Known', 'Child'], 3600),
        event(['Uncategorized'], 1800),
        event(['Deleted', 'Child'], 900),
        event(['A>>>B'], 360),
        event(['A', 'B'], 720),
      ],
    },
    { cat_events: [event(['Deleted', 'Child'], 1800), event(['Deleted', 'Child'], 900)] },
  ];
  const before = JSON.stringify({ classes, periods });
  const datasets = buildBarchartDataset(periods, classes);
  expect(datasets).toEqual([
    { label: 'Known > Child', backgroundColor: '#123456', data: [1, null] },
    { label: 'Uncategorized', backgroundColor: '#CCC', data: [0.5, null] },
    { label: 'Deleted > Child', backgroundColor: '#CCC', data: [0.25, 0.75] },
    { label: 'A>>>B', backgroundColor: '#CCC', data: [0.1, null] },
    { label: 'A > B', backgroundColor: '#CCC', data: [0.2, null] },
  ]);
  expect(JSON.stringify({ classes, periods })).toBe(before);
});

test('retains unclassified events and handles empty input', () => {
  expect(
    buildBarchartDataset([{ cat_events: [event([], 1800), event(undefined, 1800)] }], [])
  ).toEqual([{ label: 'Uncategorized', backgroundColor: '#CCC', data: [1] }]);
  expect(buildBarchartDataset([], [])).toEqual([]);
  expect(buildBarchartDataset(null, [])).toEqual([]);
});
