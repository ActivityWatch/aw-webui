import { cleanAlertGoal, cleanAlertGoals, getDefaultAlertGoals } from '~/util/alerts';

describe('cleanAlertGoal', () => {
  test('accepts a well-formed goal', () => {
    expect(cleanAlertGoal({ name: 'Work', category: ['Work'], goal: 100 })).toEqual({
      name: 'Work',
      category: ['Work'],
      goal: 100,
    });
  });

  test('normalizes the string a number input produces', () => {
    expect(cleanAlertGoal({ name: 'Work', category: ['Work'], goal: ' 45 ' })).toEqual({
      name: 'Work',
      category: ['Work'],
      goal: 45,
    });
  });

  test('trims the name', () => {
    expect(cleanAlertGoal({ name: '  Work  ', category: ['Work'], goal: 1 }).name).toBe('Work');
  });

  test('keeps nested category paths', () => {
    expect(cleanAlertGoal({ name: 'Code', category: ['Work', 'Code'], goal: 30 }).category).toEqual([
      'Work',
      'Code',
    ]);
  });

  test('copies the category array rather than aliasing the input', () => {
    const category = ['Work'];
    const cleaned = cleanAlertGoal({ name: 'Work', category, goal: 1 });
    category.push('Mutated');
    expect(cleaned.category).toEqual(['Work']);
  });

  test.each([
    ['a non-object', 'nope'],
    ['null', null],
    ['a missing name', { category: ['Work'], goal: 1 }],
    ['a blank name', { name: '   ', category: ['Work'], goal: 1 }],
    ['a non-string name', { name: 7, category: ['Work'], goal: 1 }],
    ['a null category (the "All" option)', { name: 'All', category: null, goal: 1 }],
    ['an empty category', { name: 'Empty', category: [], goal: 1 }],
    ['a non-array category', { name: 'Work', category: 'Work', goal: 1 }],
    ['a non-string category segment', { name: 'Work', category: ['Work', 3], goal: 1 }],
    ['a missing goal', { name: 'Work', category: ['Work'] }],
    ['a non-numeric goal', { name: 'Work', category: ['Work'], goal: 'abc' }],
    ['a NaN goal', { name: 'Work', category: ['Work'], goal: NaN }],
    ['an infinite goal', { name: 'Work', category: ['Work'], goal: Infinity }],
    ['a negative goal', { name: 'Work', category: ['Work'], goal: -5 }],
  ])('rejects %s', (_label, candidate) => {
    expect(cleanAlertGoal(candidate)).toBeNull();
  });
});

describe('cleanAlertGoals', () => {
  test('drops malformed entries and keeps valid ones', () => {
    expect(
      cleanAlertGoals([
        { name: 'Work', category: ['Work'], goal: 100 },
        { name: '', category: ['Broken'], goal: 1 },
        null,
        { name: 'Media', category: ['Media'], goal: '10' },
      ])
    ).toEqual([
      { name: 'Work', category: ['Work'], goal: 100 },
      { name: 'Media', category: ['Media'], goal: 10 },
    ]);
  });

  test('preserves a stored empty list', () => {
    expect(cleanAlertGoals([])).toEqual([]);
  });

  test.each([['a string', 'nope'], ['an object', { name: 'Work' }], ['null', null], ['undefined', undefined]])(
    'returns an empty list for %s',
    (_label, candidate) => {
      expect(cleanAlertGoals(candidate)).toEqual([]);
    }
  );
});

describe('getDefaultAlertGoals', () => {
  test('provides sample goals that survive their own validation', () => {
    const defaults = getDefaultAlertGoals();
    expect(defaults.length).toBeGreaterThan(0);
    expect(cleanAlertGoals(defaults)).toEqual(defaults);
  });

  test('returns a fresh array each call, so callers cannot corrupt the defaults', () => {
    const first = getDefaultAlertGoals();
    first.pop();
    expect(getDefaultAlertGoals()).toHaveLength(2);
  });
});
