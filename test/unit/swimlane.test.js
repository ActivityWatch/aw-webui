import { getSwimlane } from '~/util/swimlane';

describe('getSwimlane', () => {
  test('uses the color argument when grouping by category', () => {
    expect(getSwimlane({ type: 'currentwindow' }, '#7F6', 'category', { data: {} })).toBe('#7F6');
  });

  test('uses sanitized app name for currentwindow when grouping by bucketType', () => {
    expect(
      getSwimlane({ type: 'currentwindow' }, '#fff', 'bucketType', { data: { app: 'Firefox' } })
    ).toBe('Firefox');
  });

  test('uses hostname for web tabs when grouping by bucketType', () => {
    expect(
      getSwimlane({ type: 'web.tab.current' }, '#fff', 'bucketType', {
        data: { url: 'https://www.example.com/path' },
      })
    ).toBe('example.com');
  });

  test('returns unknown when groupBy is unrecognized', () => {
    expect(getSwimlane({ type: 'currentwindow' }, '#fff', 'other', { data: {} })).toBe('unknown');
  });
});
