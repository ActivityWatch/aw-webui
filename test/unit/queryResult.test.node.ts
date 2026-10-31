import { formatQueryResult, isEventArray, isEventLike } from '~/util/queryResult';

const event = { timestamp: '2026-10-31T12:00:00Z', duration: 10, data: { title: 'Code' } };

describe('isEventLike', () => {
  test.each([
    [event, true],
    [{ ...event, timestamp: new Date(event.timestamp), duration: 0, data: {} }, true],
    [{ duration: 5 }, false],
    [{ data: { app: 'Vim' } }, false],
    [{ timestamp: event.timestamp }, false],
    [{ timestamp: event.timestamp, duration: 5 }, false],
    [{ ...event, timestamp: null }, false],
    [{ ...event, timestamp: 42 }, false],
    [{ ...event, timestamp: 'not a date' }, false],
    [{ ...event, timestamp: new Date(NaN) }, false],
    [{ ...event, duration: '5' }, false],
    [{ ...event, duration: null }, false],
    [{ ...event, duration: NaN }, false],
    [{ ...event, duration: Infinity }, false],
    [{ ...event, data: null }, false],
    [{ ...event, data: [] }, false],
    [{ ...event, data: 'Code' }, false],
    [42, false],
    ['event', false],
    [null, false],
    [undefined, false],
    [[event], false],
    [{ title: 'not an event' }, false],
  ])('%p => %p', (value, expected) => {
    expect(isEventLike(value)).toBe(expected);
  });
});

describe('isEventArray', () => {
  test('accepts empty arrays as event-array controls', () => {
    expect(isEventArray([])).toBe(true);
  });

  test('accepts ordinary event arrays', () => {
    expect(isEventArray([event])).toBe(true);
  });

  test.each([
    [42, false],
    [{ total: 42 }, false],
    [null, false],
    [undefined, false],
    ['RETURN', false],
    [[1, 2], false],
    [[event, 1], false],
    [[{ title: 'mixed' }], false],
    [[{ duration: 5, label: 'total' }], false],
    [[event, { data: null }], false],
  ])('rejects %p', (value, expected) => {
    expect(isEventArray(value)).toBe(expected);
  });
});

describe('formatQueryResult', () => {
  test('keeps strings readable without extra quotes', () => {
    expect(formatQueryResult('hello')).toBe('hello');
  });

  test('renders null, objects and arrays as JSON', () => {
    expect(formatQueryResult(null)).toBe('null');
    expect(formatQueryResult({ total: 42 })).toContain('"total": 42');
    expect(formatQueryResult([1, 2])).toContain('1');
  });
});
