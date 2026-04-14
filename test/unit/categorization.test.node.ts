import { findCommonPhrases } from '~/util/categorization';
import { IEvent } from '~/util/interfaces';

function makeEvent(title: string, duration: number): IEvent {
  return {
    timestamp: new Date().toISOString(),
    duration,
    data: { title },
  };
}

describe('findCommonPhrases', () => {
  test('returns empty map for empty events', () => {
    expect(findCommonPhrases([], [])).toEqual(new Map());
  });

  test('counts single words by duration', () => {
    // Single-word titles produce no bigrams, so durations accumulate directly
    const events = [makeEvent('hello', 100), makeEvent('hello', 50), makeEvent('world', 80)];
    const result = findCommonPhrases(events, []);
    expect(result.get('hello')?.duration).toBeCloseTo(150);
    expect(result.get('world')?.duration).toBeCloseTo(80);
  });

  test('promotes bigram when it dominates both constituent words', () => {
    // "Mozilla Firefox" always appears together
    const events = [makeEvent('Mozilla Firefox', 100), makeEvent('Mozilla Firefox', 100)];
    const result = findCommonPhrases(events, []);
    // Bigram should be promoted
    expect(result.get('Mozilla Firefox')).toBeDefined();
    expect(result.get('Mozilla Firefox')?.duration).toBe(200);
    // Constituent word durations reduced to 0
    expect(result.get('Mozilla')?.duration).toBe(0);
    expect(result.get('Firefox')?.duration).toBe(0);
  });

  test('does not promote bigram when one word appears independently too often', () => {
    const events = [
      makeEvent('Mozilla Firefox', 60),
      makeEvent('Mozilla Browser', 100), // "Mozilla" has independent time
    ];
    // Mozilla total: 160, Firefox: 60, bigram "Mozilla Firefox": 60
    // 60/160 = 0.375 < 0.5 → bigram NOT promoted
    const result = findCommonPhrases(events, []);
    expect(result.get('Mozilla Firefox')).toBeUndefined();
    expect(result.get('Mozilla')).toBeDefined();
    expect(result.get('Firefox')).toBeDefined();
  });

  test('filters out words with length <= 2', () => {
    const events = [makeEvent('is at go home', 100)];
    const result = findCommonPhrases(events, []);
    expect(result.get('is')).toBeUndefined();
    expect(result.get('at')).toBeUndefined();
    expect(result.get('go')).toBeUndefined();
    expect(result.get('home')).toBeDefined();
  });

  test('filters out ignored words', () => {
    const events = [makeEvent('GitHub Chrome Test', 100)];
    const result = findCommonPhrases(events, ['GitHub', 'Chrome']);
    expect(result.get('GitHub')).toBeUndefined();
    expect(result.get('Chrome')).toBeUndefined();
    expect(result.get('Test')).toBeDefined();
  });

  test('ignored words are not used as bigram components', () => {
    const events = [makeEvent('GitHub Desktop', 100), makeEvent('GitHub Desktop', 100)];
    const result = findCommonPhrases(events, ['GitHub']);
    // "GitHub" is ignored, so "GitHub Desktop" bigram should not be promoted
    expect(result.get('GitHub Desktop')).toBeUndefined();
    expect(result.get('Desktop')).toBeDefined();
  });

  test('handles titles split by various separator characters', () => {
    const events = [makeEvent('foo-bar,baz:qux(quux)', 100)];
    const result = findCommonPhrases(events, []);
    expect(result.get('foo')).toBeDefined();
    expect(result.get('bar')).toBeDefined();
    expect(result.get('baz')).toBeDefined();
    expect(result.get('qux')).toBeDefined();
    expect(result.get('quux')).toBeDefined();
  });

  test('accumulated duration across multiple events', () => {
    const events = [
      makeEvent('Python Programming', 30),
      makeEvent('Python Programming', 30),
      makeEvent('Python Programming', 30),
      makeEvent('Python Programming', 30),
    ];
    const result = findCommonPhrases(events, []);
    // All events have same title → bigram fully dominates
    expect(result.get('Python Programming')?.duration).toBe(120);
    expect(result.get('Python')?.duration).toBe(0);
    expect(result.get('Programming')?.duration).toBe(0);
  });

  test('returns Map with word entries containing events list', () => {
    const events = [makeEvent('Hello World', 100)];
    const result = findCommonPhrases(events, []);
    const entry = result.get('Hello');
    expect(entry).toBeDefined();
    expect(entry?.word).toBe('Hello');
    expect(entry?.events).toHaveLength(1);
    expect(entry?.events[0]).toBe(events[0]);
  });

  test('trigram: does not double-promote when middle word duration is consumed', () => {
    // "Alpha Beta" dominates (110s); "Alpha Beta Gamma" appears rarely (10s).
    // Word totals: Alpha=110, Beta=110, Gamma=10
    // Bigram totals: "Alpha Beta"=110, "Beta Gamma"=10
    // "Alpha Beta" correctly promotes (110/110 > 0.5 for both words).
    // After promotion, Beta.duration drops to 0.  Without snapshotting original
    // durations, "Beta Gamma" sees 10/0 = Infinity and incorrectly promotes too.
    // With the fix, the check uses the original Beta=110: 10/110 ≈ 0.09 < 0.5 → no promotion.
    const events = [makeEvent('Alpha Beta', 100), makeEvent('Alpha Beta Gamma', 10)];
    const result = findCommonPhrases(events, []);
    expect(result.get('Alpha Beta')).toBeDefined(); // correctly promoted
    expect(result.get('Beta Gamma')).toBeUndefined(); // must NOT be promoted
    const betaEntry = result.get('Beta');
    expect(betaEntry?.duration).toBeGreaterThanOrEqual(0); // no negative durations
  });
});
