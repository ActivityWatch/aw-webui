import { getSwimlane } from '~/util/swimlane';
import { IEvent } from '~/util/interfaces';

// Only `data` matters to getSwimlane
const event = (data: object) => ({ data } as IEvent);

describe('getSwimlane', () => {
  test('uses the color argument when grouping by category', () => {
    expect(getSwimlane({ type: 'currentwindow' }, '#7F6', 'category', event({}))).toBe('#7F6');
  });

  test('uses sanitized app name for currentwindow when grouping by bucketType', () => {
    expect(
      getSwimlane({ type: 'currentwindow' }, '#fff', 'bucketType', event({ app: 'Firefox' }))
    ).toBe('Firefox');
  });

  test('uses hostname for web tabs when grouping by bucketType', () => {
    expect(
      getSwimlane(
        { type: 'web.tab.current' },
        '#fff',
        'bucketType',
        event({ url: 'https://www.example.com/path' })
      )
    ).toBe('example.com');
  });

  test('returns unknown when groupBy is unrecognized', () => {
    expect(getSwimlane({ type: 'currentwindow' }, '#fff', 'other', event({}))).toBe('unknown');
  });
});
