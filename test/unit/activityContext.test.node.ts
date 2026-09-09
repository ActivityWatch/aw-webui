import {
  buildActivityContext,
  computeFocusStats,
  formatActivityContext,
  isUnderCategory,
  privateCategoriesFrom,
  type ContextEvent,
  type PrivacyOptions,
} from '~/util/activityContext';

const NO_PRIVACY: PrivacyOptions = { excludeUncategorized: false, privateCategories: [] };

function event(
  app: string,
  duration: number,
  opts: { title?: string; category?: string[]; timestamp?: string } = {}
): ContextEvent {
  return {
    timestamp: opts.timestamp ?? '2026-08-01T09:00:00+00:00',
    duration,
    data: {
      app,
      ...(opts.title ? { title: opts.title } : {}),
      ...(opts.category ? { $category: opts.category } : {}),
    },
  };
}

function build(events: ContextEvent[], overrides: Record<string, any> = {}) {
  return buildActivityContext({
    events,
    trackedSeconds: events.reduce((s, e) => s + e.duration, 0),
    start: new Date('2026-08-01T00:00:00Z'),
    end: new Date('2026-08-08T00:00:00Z'),
    hosts: ['testhost'],
    timezone: 'UTC',
    privacy: NO_PRIVACY,
    ...overrides,
  });
}

describe('buildActivityContext — aggregation', () => {
  test('aggregates app durations and sorts descending', () => {
    const ctx = build([event('Firefox', 300), event('Terminal', 60), event('Firefox', 120)]);
    expect(ctx.apps.map(a => a.app)).toEqual(['Firefox', 'Terminal']);
    expect(ctx.apps[0].duration).toBe(420);
  });

  test('counts distinct titles without exporting them', () => {
    const ctx = build([
      event('Firefox', 100, { title: 'GitHub' }),
      event('Firefox', 100, { title: 'GitHub' }),
      event('Firefox', 100, { title: 'Hacker News' }),
    ]);
    expect(ctx.apps[0].titleCount).toBe(2);
    expect(JSON.stringify(ctx)).not.toContain('Hacker News');
  });

  test('rolls up categories', () => {
    const ctx = build([
      event('vim', 600, { category: ['Work', 'Programming'] }),
      event('Slack', 300, { category: ['Comms'] }),
      event('nvim', 300, { category: ['Work', 'Programming'] }),
    ]);
    expect(ctx.categories[0]).toMatchObject({
      category: ['Work', 'Programming'],
      duration: 900,
      share: 0.75,
    });
  });

  test('aggregates browser domains and never exposes full URLs', () => {
    const ctx = build([event('Firefox', 100)], {
      domainEvents: [
        { duration: 200, data: { $domain: 'github.com' } },
        { duration: 50, data: { $domain: 'news.ycombinator.com' } },
        { duration: 100, data: { $domain: 'github.com' } },
      ],
    });
    expect(ctx.domains[0]).toEqual({ domain: 'github.com', duration: 300, share: 300 / 350 });
    expect(JSON.stringify(ctx)).not.toContain('http');
  });

  test('groups active time per day in the context timezone', () => {
    const ctx = build([
      event('vim', 100, { timestamp: '2026-08-01T23:30:00+00:00' }),
      event('vim', 200, { timestamp: '2026-08-02T01:00:00+00:00' }),
    ]);
    expect(ctx.daily).toEqual([
      { date: '2026-08-01', duration: 100 },
      { date: '2026-08-02', duration: 200 },
    ]);
  });

  test('day grouping honours a non-UTC timezone', () => {
    const ctx = build([event('vim', 100, { timestamp: '2026-08-01T23:30:00+00:00' })], {
      timezone: 'Europe/Stockholm',
    });
    expect(ctx.daily).toEqual([{ date: '2026-08-02', duration: 100 }]);
  });

  test('splits events that span local midnight across both days', () => {
    // Event starts at 23:30 UTC on Aug 1, lasts 3600s (1h), ending at 00:30 UTC on Aug 2.
    // In UTC: 1800s on Aug 1 (23:30–00:00) and 1800s on Aug 2 (00:00–00:30).
    const ctx = build([event('vim', 3600, { timestamp: '2026-08-01T23:30:00+00:00' })], {
      timezone: 'UTC',
    });
    const byDate: Record<string, number> = Object.fromEntries(
      ctx.daily.map(d => [d.date, d.duration])
    );
    expect(Object.keys(byDate).sort()).toEqual(['2026-08-01', '2026-08-02']);
    expect(byDate['2026-08-01']).toBeCloseTo(1800, 0); // 30 min before midnight
    expect(byDate['2026-08-02']).toBeCloseTo(1800, 0); // 30 min after midnight
    expect(byDate['2026-08-01'] + byDate['2026-08-02']).toBeCloseTo(3600, 0);
  });
});

describe('buildActivityContext — coverage and denominators', () => {
  test('active share is relative to tracked time, not to active time', () => {
    const ctx = build([event('vim', 300)], { trackedSeconds: 600 });
    expect(ctx.coverage.activeSeconds).toBe(300);
    expect(ctx.coverage.trackedSeconds).toBe(600);
    expect(ctx.coverage.activeShare).toBe(0.5);
  });

  test('app shares use exported time as the denominator, and sum to 1', () => {
    const ctx = build([event('vim', 300), event('Slack', 100)]);
    expect(ctx.apps.reduce((s, a) => s + a.share, 0)).toBeCloseTo(1);
  });

  test('shares use exported time, not active time, when privacy drops events', () => {
    const ctx = build(
      [event('vim', 300, { category: ['Work'] }), event('Signal', 100, { category: ['Private'] })],
      { privacy: { excludeUncategorized: false, privateCategories: [['Private']] } }
    );
    expect(ctx.coverage.activeSeconds).toBe(400);
    expect(ctx.coverage.exportedSeconds).toBe(300);
    expect(ctx.apps[0].share).toBe(1);
  });

  test('activeShare is null rather than NaN when nothing was tracked', () => {
    const ctx = build([], { trackedSeconds: 0 });
    expect(ctx.coverage.activeShare).toBeNull();
    expect(ctx.privacy.coverage).toBe(1);
  });
});

describe('buildActivityContext — missing buckets and rules', () => {
  test('handles no events at all', () => {
    const ctx = build([]);
    expect(ctx.apps).toEqual([]);
    expect(ctx.categories).toEqual([]);
    expect(ctx.daily).toEqual([]);
    expect(ctx.focus).toEqual({
      appSwitches: 0,
      blockCount: 0,
      longestBlockSeconds: 0,
      medianBlockSeconds: 0,
    });
  });

  test('handles a missing browser bucket (no domain events)', () => {
    const ctx = build([event('vim', 100)]);
    expect(ctx.domains).toEqual([]);
    expect(ctx.truncation.domains).toEqual({ shown: 0, total: 0, otherSeconds: 0 });
  });

  test('treats events with no category rule match as Uncategorized', () => {
    const ctx = build([event('vim', 100)]);
    expect(ctx.categories[0].category).toEqual(['Uncategorized']);
  });

  test('falls back to a placeholder app name when the field is missing', () => {
    const ctx = build([{ timestamp: '2026-08-01T09:00:00+00:00', duration: 30, data: {} }]);
    expect(ctx.apps[0].app).toBe('unknown');
    expect(ctx.apps[0].titleCount).toBe(0);
  });
});

describe('buildActivityContext — truncation', () => {
  test('limits apps and reports what was dropped', () => {
    const events = Array.from({ length: 20 }, (_, i) => event(`app${i}`, 100 - i));
    const ctx = build(events, { limits: { apps: 5 } });
    expect(ctx.apps).toHaveLength(5);
    expect(ctx.truncation.apps.shown).toBe(5);
    expect(ctx.truncation.apps.total).toBe(20);
    // The 15 dropped apps have durations 95..81.
    expect(ctx.truncation.apps.otherSeconds).toBe(
      Array.from({ length: 15 }, (_, i) => 95 - i).reduce((s, d) => s + d, 0)
    );
  });

  test('truncation keeps the highest-duration entries', () => {
    const ctx = build([event('a', 10), event('b', 500), event('c', 250)], {
      limits: { apps: 2 },
    });
    expect(ctx.apps.map(a => a.app)).toEqual(['b', 'c']);
  });

  test('does not truncate when under the limit', () => {
    const ctx = build([event('a', 10)], { limits: { apps: 5 } });
    expect(ctx.truncation.apps).toEqual({ shown: 1, total: 1, otherSeconds: 0 });
  });
});

describe('privacy filter', () => {
  test('excludes categories the user marked private, including sub-categories', () => {
    const ctx = build(
      [
        event('vim', 600, { category: ['Work', 'Programming'] }),
        event('Signal', 300, { category: ['Private', 'Messaging'] }),
        event('Browser', 100, { category: ['Private'] }),
      ],
      { privacy: { excludeUncategorized: false, privateCategories: [['Private']] } }
    );
    expect(ctx.apps.map(a => a.app)).toEqual(['vim']);
    expect(ctx.privacy.excludedSeconds).toBe(400);
    expect(ctx.privacy.coverage).toBe(600 / 1000);
    expect(JSON.stringify(ctx.apps)).not.toContain('Signal');
  });

  test('excludes uncategorized activity when asked', () => {
    const ctx = build([event('vim', 600, { category: ['Work'] }), event('mystery-app', 400)], {
      privacy: { excludeUncategorized: true, privateCategories: [] },
    });
    expect(ctx.apps.map(a => a.app)).toEqual(['vim']);
    expect(ctx.privacy.excludedCategories).toEqual([['Uncategorized']]);
    expect(ctx.privacy.excludedSeconds).toBe(400);
  });

  test('drops browser domains entirely while a privacy filter is active', () => {
    const ctx = build([event('vim', 100, { category: ['Work'] })], {
      privacy: { excludeUncategorized: true, privateCategories: [] },
      domainEvents: [{ duration: 200, data: { $domain: 'private-clinic.example' } }],
    });
    expect(ctx.domains).toEqual([]);
    expect(JSON.stringify(ctx)).not.toContain('private-clinic');
  });

  test('reports full coverage when nothing was withheld', () => {
    const ctx = build([event('vim', 600, { category: ['Work'] })], {
      privacy: { excludeUncategorized: true, privateCategories: [] },
    });
    expect(ctx.privacy.excludedSeconds).toBe(0);
    expect(ctx.privacy.coverage).toBe(1);
  });
});

describe('isUnderCategory', () => {
  test('matches the category itself and its descendants', () => {
    expect(isUnderCategory(['Work'], ['Work'])).toBe(true);
    expect(isUnderCategory(['Work', 'Programming'], ['Work'])).toBe(true);
  });

  test('does not match a sibling with a shared prefix string', () => {
    expect(isUnderCategory(['Workout'], ['Work'])).toBe(false);
    expect(isUnderCategory(['Work'], ['Work', 'Programming'])).toBe(false);
  });

  test('never matches an empty parent', () => {
    expect(isUnderCategory(['Work'], [])).toBe(false);
  });
});

describe('privateCategoriesFrom', () => {
  test('picks up categories flagged in user-controlled metadata', () => {
    const classes = [
      { name: ['Work'], data: { color: '#0F0' } },
      { name: ['Private'], data: { private: true } },
      { name: ['Health'], data: { private: false } },
      { name: ['Other'] },
    ];
    expect(privateCategoriesFrom(classes)).toEqual([['Private']]);
  });
});

describe('computeFocusStats', () => {
  test('merges consecutive events in the same app into one block', () => {
    const stats = computeFocusStats([event('vim', 100), event('vim', 200), event('Slack', 50)]);
    expect(stats.blockCount).toBe(2);
    expect(stats.appSwitches).toBe(1);
    expect(stats.longestBlockSeconds).toBe(300);
  });

  test('counts a return to a previous app as a new block', () => {
    const stats = computeFocusStats([event('vim', 100), event('Slack', 50), event('vim', 100)]);
    expect(stats.blockCount).toBe(3);
    expect(stats.appSwitches).toBe(2);
  });

  test('median of an even number of blocks averages the middle two', () => {
    const stats = computeFocusStats([
      event('a', 10),
      event('b', 20),
      event('c', 30),
      event('d', 40),
    ]);
    expect(stats.medianBlockSeconds).toBe(25);
  });

  test('single block means zero switches', () => {
    const stats = computeFocusStats([event('vim', 100)]);
    expect(stats).toEqual({
      appSwitches: 0,
      blockCount: 1,
      longestBlockSeconds: 100,
      medianBlockSeconds: 100,
    });
  });
});

describe('formatActivityContext', () => {
  test('renders the sections a single-pass model needs', () => {
    const ctx = build([
      event('vim', 3600, { category: ['Work', 'Programming'], title: 'main.ts' }),
      event('Slack', 600, { category: ['Comms'], title: 'general' }),
    ]);
    const text = formatActivityContext(ctx);
    expect(text).toContain('Activity context — 2026-08-01 to 2026-08-08');
    expect(text).toContain('Host(s): testhost');
    expect(text).toContain('Work > Programming');
    expect(text).toContain('App switches: 1');
  });

  test('never renders window titles', () => {
    const ctx = build([event('vim', 3600, { title: 'secret-project-plan.md' })]);
    expect(formatActivityContext(ctx)).not.toContain('secret-project-plan');
  });

  test('states what the privacy filter withheld without leaking category names', () => {
    const ctx = build(
      [event('vim', 600, { category: ['Work'] }), event('Signal', 600, { category: ['Health'] })],
      { privacy: { excludeUncategorized: false, privateCategories: [['Health']] } }
    );
    const text = formatActivityContext(ctx);
    expect(text).toContain('Privacy filter: withheld');
    expect(text).toContain('50% of active time');
    // The excluded category name must NOT be sent to the LLM provider.
    expect(text).not.toContain('Health');
    // The count of excluded categories should appear instead.
    expect(text).toContain('1 excluded category');
  });

  test('uses plural "categories" when multiple categories are excluded', () => {
    const ctx = build(
      [
        event('vim', 300, { category: ['Work'] }),
        event('app1', 100, { category: ['Health'] }),
        event('app2', 100, { category: ['Finance'] }),
      ],
      {
        privacy: {
          excludeUncategorized: false,
          privateCategories: [['Health'], ['Finance']],
        },
      }
    );
    const text = formatActivityContext(ctx);
    expect(text).toContain('2 excluded categories');
    expect(text).not.toContain('Health');
    expect(text).not.toContain('Finance');
  });

  test('flags truncated sections so the model knows the list is partial', () => {
    const events = Array.from({ length: 8 }, (_, i) => event(`app${i}`, 100));
    const ctx = build(events, { limits: { apps: 3 } });
    expect(formatActivityContext(ctx)).toContain('(+5 more');
  });
});
