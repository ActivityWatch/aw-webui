import {
  aggregateEvents,
  buildSummaryText,
  formatDurationHuman,
  loadLLMConfig,
  saveLLMConfig,
} from '~/util/aiSummary';

describe('aggregateEvents', () => {
  test('returns empty array for no events', () => {
    expect(aggregateEvents([])).toEqual([]);
  });

  test('aggregates duration by app', () => {
    const events = [
      { data: { app: 'Firefox' }, duration: 300 },
      { data: { app: 'Firefox' }, duration: 120 },
      { data: { app: 'Terminal' }, duration: 60 },
    ];
    const result = aggregateEvents(events);
    expect(result[0]).toEqual({ app: 'Firefox', duration: 420 });
    expect(result[1]).toEqual({ app: 'Terminal', duration: 60 });
  });

  test('sorts by duration descending', () => {
    const events = [
      { data: { app: 'Slack' }, duration: 10 },
      { data: { app: 'VS Code' }, duration: 1000 },
      { data: { app: 'Chrome' }, duration: 500 },
    ];
    const result = aggregateEvents(events);
    expect(result.map(r => r.app)).toEqual(['VS Code', 'Chrome', 'Slack']);
  });

  test('falls back to title when app is missing', () => {
    const events = [{ data: { title: 'My Window' }, duration: 90 }];
    const result = aggregateEvents(events);
    expect(result[0].app).toBe('My Window');
  });

  test('falls back to unknown when data is empty', () => {
    const events = [{ data: {}, duration: 30 }];
    const result = aggregateEvents(events);
    expect(result[0].app).toBe('unknown');
  });
});

describe('formatDurationHuman', () => {
  test('formats seconds under 60', () => {
    expect(formatDurationHuman(45)).toBe('45s');
  });

  test('formats minutes under 3600', () => {
    expect(formatDurationHuman(90)).toBe('2m');
    expect(formatDurationHuman(3540)).toBe('59m');
  });

  test('formats hours with minutes', () => {
    expect(formatDurationHuman(3660)).toBe('1h 1m');
    expect(formatDurationHuman(7200)).toBe('2h');
  });
});

describe('LLM config storage', () => {
  const values = new Map<string, string>();

  beforeAll(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        clear: () => values.clear(),
      },
      configurable: true,
    });
  });
  beforeEach(() => values.clear());

  test('persists provider settings without the API key', () => {
    saveLLMConfig({ provider: 'openai', model: 'gpt-4o-mini', apiKey: 'secret' });

    expect(loadLLMConfig()).toEqual({ provider: 'openai', model: 'gpt-4o-mini' });
    expect(localStorage.getItem('aw-ai-summary-llm-config')).not.toContain('secret');
  });
});

describe('buildSummaryText', () => {
  test('includes period and total duration', () => {
    const data = {
      topApps: [{ app: 'Firefox', duration: 3600 }],
      totalDuration: 3600,
      periodDays: 7,
    };
    const text = buildSummaryText(data);
    expect(text).toContain('past 7 day(s)');
    expect(text).toContain('Total tracked time: 1h');
  });

  test('includes top apps', () => {
    const data = {
      topApps: [
        { app: 'VS Code', duration: 7200 },
        { app: 'Chrome', duration: 1800 },
      ],
      totalDuration: 9000,
      periodDays: 1,
    };
    const text = buildSummaryText(data);
    expect(text).toContain('VS Code');
    expect(text).toContain('Chrome');
  });

  test('caps at 20 apps', () => {
    const apps = Array.from({ length: 25 }, (_, i) => ({ app: `App${i}`, duration: 100 - i }));
    const data = { topApps: apps, totalDuration: 2500, periodDays: 7 };
    const text = buildSummaryText(data);
    expect(text).toContain('App0');
    expect(text).not.toContain('App20');
  });
});
