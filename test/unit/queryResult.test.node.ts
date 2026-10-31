import { formatQueryResult, isEventArray, isEventLike } from '~/util/queryResult';

const event = { timestamp: '2026-10-31T12:00:00Z', duration: 10, data: { title: 'Code' } };

describe('isEventLike', () => {
  test.each([
    [event, true],
    [{ duration: 5 }, true],
    [{ data: { app: 'Vim' } }, true],
    [{ timestamp: '2026-10-31T12:00:00Z' }, true],
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
