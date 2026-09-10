import { activeHistoryCacheKey, selectPeriodsToQuery } from '~/util/activeHistory';

const baseContext = {
  platform: 'desktop' as const,
  host: 'hostA',
  useMultidevice: false,
  startOfDay: '04:00',
  filter_afk: true,
  include_audible: false,
  always_active_pattern: '',
};

const baseSources = [
  { bid_afk: 'aw-watcher-afk_hostA', bid_window: 'aw-watcher-window_hostA', bid_browsers: ['b1'] },
];

const key = (ctx = {}, sources = baseSources) =>
  activeHistoryCacheKey({ ...baseContext, ...ctx }, sources);

describe('activeHistoryCacheKey', () => {
  test('identical context and sources produce the same key', () => {
    expect(key()).toBe(key());
  });

  test.each([
    ['host', { host: 'hostB' }],
    ['platform', { platform: 'android' as const }],
    ['multidevice mode', { useMultidevice: true }],
    ['day boundary', { startOfDay: '00:00' }],
    ['filter_afk', { filter_afk: false }],
    ['include_audible', { include_audible: true }],
    ['always_active_pattern', { always_active_pattern: 'mpv' }],
  ])('a different %s produces a different key', (_label, override) => {
    expect(key(override)).not.toBe(key());
  });

  test.each([
    [
      'afk bucket',
      [
        {
          bid_afk: 'aw-watcher-afk_other',
          bid_window: 'aw-watcher-window_hostA',
          bid_browsers: ['b1'],
        },
      ],
    ],
    [
      'window bucket',
      [{ bid_afk: 'aw-watcher-afk_hostA', bid_window: 'other', bid_browsers: ['b1'] }],
    ],
    [
      'browser bucket set',
      [
        {
          bid_afk: 'aw-watcher-afk_hostA',
          bid_window: 'aw-watcher-window_hostA',
          bid_browsers: ['b2'],
        },
      ],
    ],
    ['added source', [...baseSources, { bid_afk: 'aw-watcher-afk_hostB' }]],
    ['removed source', []],
  ])('a different %s produces a different key', (_label, sources) => {
    expect(key({}, sources as any)).not.toBe(key());
  });

  test('source discovery order does not affect the key', () => {
    const a = [{ bid_afk: 'afk_a' }, { bid_afk: 'afk_b' }];
    const b = [{ bid_afk: 'afk_b' }, { bid_afk: 'afk_a' }];
    expect(key({}, a)).toBe(key({}, b));
  });

  test('browser bucket order does not affect the key', () => {
    const a = [{ bid_afk: 'afk', bid_browsers: ['b1', 'b2'] }];
    const b = [{ bid_afk: 'afk', bid_browsers: ['b2', 'b1'] }];
    expect(key({}, a)).toBe(key({}, b));
  });

  test('a bare bucket id is equivalent to an AFK-only source', () => {
    expect(key({}, ['afk_only'] as any)).toBe(key({}, [{ bid_afk: 'afk_only' }]));
  });

  test('a missing browser list matches an empty one', () => {
    expect(key({}, [{ bid_afk: 'afk' }])).toBe(key({}, [{ bid_afk: 'afk', bid_browsers: [] }]));
  });

  test('an omitted filter_afk matches an explicit true', () => {
    // activeDurationQuery reads it as `filter_afk !== false`, so the key must
    // normalize the same way or a default-on view would miss its own cache.
    expect(key({ filter_afk: undefined })).toBe(key({ filter_afk: true }));
    expect(key({ filter_afk: false })).not.toBe(key({ filter_afk: true }));
  });

  test('undefined semantic options match their falsy defaults', () => {
    expect(
      activeHistoryCacheKey(
        { platform: 'desktop', host: 'h', useMultidevice: false, startOfDay: '04:00' },
        [{ bid_afk: 'afk' }]
      )
    ).toBe(
      activeHistoryCacheKey(
        {
          platform: 'desktop',
          host: 'h',
          useMultidevice: false,
          startOfDay: '04:00',
          include_audible: false,
          always_active_pattern: '',
        },
        [{ bid_afk: 'afk' }]
      )
    );
  });
});

describe('selectPeriodsToQuery', () => {
  // Three consecutive days; "now" sits inside 2026-09-10.
  const day = (d: string) =>
    `2026-09-${d}T00:00:00+00:00/2026-09-${String(Number(d) + 1).padStart(2, '0')}T00:00:00+00:00`;
  const past = day('08');
  const yesterday = day('09');
  const today = day('10');
  const future = day('11');
  const now = new Date('2026-09-10T12:00:00+00:00');

  test('queries everything when nothing is cached', () => {
    expect(selectPeriodsToQuery([past, yesterday, today], {}, now)).toEqual([
      past,
      yesterday,
      today,
    ]);
  });

  test('skips closedPeriod periods already cached', () => {
    expect(
      selectPeriodsToQuery([past, yesterday, today], { [past]: [], [yesterday]: [] }, now)
    ).toEqual([today]);
  });

  test('a cached empty result counts as cached', () => {
    // Nothing happened that day; that answer does not change.
    expect(selectPeriodsToQuery([past], { [past]: [] }, now)).toEqual([]);
  });

  test('always refreshes the open period even when cached', () => {
    expect(selectPeriodsToQuery([today], { [today]: [{ duration: 5 }] }, now)).toEqual([today]);
  });

  test('never queries a future period, cached or not', () => {
    expect(selectPeriodsToQuery([future], {}, now)).toEqual([]);
    expect(selectPeriodsToQuery([future], { [future]: [] }, now)).toEqual([]);
  });

  test('returns nothing when every period is cached and closedPeriod', () => {
    expect(selectPeriodsToQuery([past, yesterday], { [past]: [], [yesterday]: [] }, now)).toEqual(
      []
    );
  });

  test('overlapping navigation only asks for the missing periods', () => {
    const cached = { [yesterday]: [], [today]: [] };
    expect(selectPeriodsToQuery([past, yesterday, today], cached, now)).toEqual([past, today]);
  });

  test('a period starting exactly at now is treated as future', () => {
    const boundary = '2026-09-10T12:00:00+00:00/2026-09-11T12:00:00+00:00';
    expect(selectPeriodsToQuery([boundary], {}, now)).toEqual([]);
  });

  test('a period ending exactly at now is closedPeriod and cacheable', () => {
    const closedPeriod = '2026-09-09T12:00:00+00:00/2026-09-10T12:00:00+00:00';
    expect(selectPeriodsToQuery([closedPeriod], {}, now)).toEqual([closedPeriod]);
    expect(selectPeriodsToQuery([closedPeriod], { [closedPeriod]: [] }, now)).toEqual([]);
  });

  test('respects a non-midnight day boundary', () => {
    // With a 04:00 boundary, the activity day starting 2026-09-09T04:00 is the
    // one containing 02:00 on the 10th, so it is still open.
    const activityDay = '2026-09-09T04:00:00+00:00/2026-09-10T04:00:00+00:00';
    const at2am = new Date('2026-09-10T02:00:00+00:00');
    expect(selectPeriodsToQuery([activityDay], { [activityDay]: [] }, at2am)).toEqual([
      activityDay,
    ]);
  });

  test('an unparseable period is queried rather than dropped', () => {
    expect(selectPeriodsToQuery(['garbage'], {}, now)).toEqual(['garbage']);
  });

  test('an empty period list stays empty', () => {
    expect(selectPeriodsToQuery([], {}, now)).toEqual([]);
  });

  test('inherited object properties are not mistaken for cached periods', () => {
    // A period literally named "constructor" must not appear cached via the
    // prototype chain.
    const weird = '2026-09-08T00:00:00+00:00/2026-09-09T00:00:00+00:00';
    expect(selectPeriodsToQuery([weird], Object.create({ [weird]: [] }), now)).toEqual([weird]);
  });
});
