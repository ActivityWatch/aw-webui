import moment from 'moment';
import sunburst from '~/visualizations/sunburst-clock';
import * as classes from '~/util/classes';
import { getColorFromString } from '~/util/color';

// Renders the clock into a detached element and returns the texts of all
// markers drawn around the dial.
function renderMarkers(startOfDay) {
  const el = document.createElement('div');
  el.innerHTML = '<div class="legend"></div><div class="sequence"></div>';
  sunburst.create(el);

  const root_event = {
    timestamp: startOfDay.toISOString(),
    duration: 0,
    data: { title: 'ROOT' },
    children: [],
  };
  sunburst.update(el, root_event, startOfDay.clone());

  return {
    el,
    markers: Array.from(el.querySelectorAll('#container text')).map(t => t.textContent),
  };
}

function nowMarkerCount(startOfDay) {
  return renderMarkers(startOfDay).markers.filter(t => t === 'Now').length;
}

describe('sunburst-clock Now marker', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  function freeze(local) {
    jest.useFakeTimers().setSystemTime(moment(local).toDate());
  }

  test('draws exactly one Now marker for the period containing now', () => {
    freeze('2026-09-10T15:30:00');
    expect(nowMarkerCount(moment('2026-09-10T00:00:00'))).toBe(1);
  });

  test('draws no Now marker for a historical period', () => {
    freeze('2026-09-10T15:30:00');
    expect(nowMarkerCount(moment('2026-09-01T00:00:00'))).toBe(0);
  });

  test('draws no Now marker for a future period', () => {
    freeze('2026-09-10T15:30:00');
    expect(nowMarkerCount(moment('2026-09-20T00:00:00'))).toBe(0);
  });

  test('includes now exactly at the start of the period', () => {
    freeze('2026-09-10T00:00:00');
    expect(nowMarkerCount(moment('2026-09-10T00:00:00'))).toBe(1);
  });

  test('excludes now exactly at the end of the period', () => {
    // The day shown starts 2026-09-09T00:00 and ends 2026-09-10T00:00.
    freeze('2026-09-10T00:00:00');
    expect(nowMarkerCount(moment('2026-09-09T00:00:00'))).toBe(0);
  });

  test('with a 04:00 day start, 02:00 belongs to the preceding activity day', () => {
    freeze('2026-09-10T02:00:00');
    // The activity day starting 2026-09-09T04:00 runs to 2026-09-10T04:00,
    // so 02:00 is inside it despite the differing calendar date.
    expect(nowMarkerCount(moment('2026-09-09T04:00:00'))).toBe(1);
    // ...and is outside the activity day starting on its own calendar date.
    expect(nowMarkerCount(moment('2026-09-10T04:00:00'))).toBe(0);
  });

  test('respects a fractional-hour day start', () => {
    freeze('2026-09-10T04:15:00');
    expect(nowMarkerCount(moment('2026-09-10T04:30:00'))).toBe(0);
    expect(nowMarkerCount(moment('2026-09-09T04:30:00'))).toBe(1);
  });

  test('switching periods leaves no stale Now marker', () => {
    freeze('2026-09-10T15:30:00');
    const el = document.createElement('div');
    el.innerHTML = '<div class="legend"></div><div class="sequence"></div>';
    sunburst.create(el);

    const render = startOfDay => {
      sunburst.update(
        el,
        {
          timestamp: startOfDay.toISOString(),
          duration: 0,
          data: { title: 'ROOT' },
          children: [],
        },
        startOfDay.clone()
      );
      return Array.from(el.querySelectorAll('#container text')).map(t => t.textContent);
    };

    expect(render(moment('2026-09-10T00:00:00')).filter(t => t === 'Now')).toHaveLength(1);
    // Re-rendering a historical day must clear the marker from the previous render.
    expect(render(moment('2026-09-01T00:00:00')).filter(t => t === 'Now')).toHaveLength(0);
  });

  test('keeps the standard clock ticks regardless of the Now marker', () => {
    freeze('2026-09-10T15:30:00');
    const past = renderMarkers(moment('2026-09-01T00:00:00')).markers;
    const today = renderMarkers(moment('2026-09-10T00:00:00')).markers;

    for (const tick of ['00:00', '06:00', '12:00', '18:00']) {
      expect(past).toContain(tick);
      expect(today).toContain(tick);
    }
    expect(today.filter(t => t === 'Now')).toHaveLength(1);
    expect(past).not.toContain('Now');
  });
});

// Exercise the actual SVG fill callback, not a parallel implementation of it.
describe('sunburst-clock category colors', () => {
  const categories: classes.Category[] = [
    { name: ['Work'], rule: { type: 'none' }, data: { color: '#123456' } },
    { name: ['Work', 'Code'], rule: { type: 'regex', regex: '^Project Alpha$' } },
    {
      name: ['Media'],
      rule: { type: 'regex', regex: 'Movie' },
      data: { color: '#654321' },
    },
  ];

  beforeEach(() => {
    jest.spyOn(classes, 'loadClasses').mockReturnValue(categories);
    localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  function renderColors(windowData) {
    const el = document.createElement('div');
    el.innerHTML = '<div class="legend"></div><div class="sequence"></div>';
    sunburst.create(el);
    const start = moment('2026-09-01T00:00:00');
    const windowEvent = {
      timestamp: start.clone().add(1, 'hour').toISOString(),
      duration: 3600,
      data: windowData,
    };
    const statusEvent = {
      timestamp: start.toISOString(),
      duration: 86400,
      data: { status: 'not-afk' },
      children: [windowEvent],
    };
    sunburst.update(
      el,
      { timestamp: start.toISOString(), duration: 86400, data: {}, children: [statusEvent] },
      start
    );
    const paths = Array.from(el.querySelectorAll<SVGPathElement>('#container path'));
    return {
      status: paths[1].style.fill,
      window: paths[2].style.fill,
    };
  }

  test('uses the inherited category color matched by window title', () => {
    const colors = renderColors({ app: 'editor', title: 'Project Alpha' });
    expect(colors.window).toBe('#123456');
    expect(colors.status).toBe(getColorFromString('not-afk'));
  });

  test('uses the explicit category color instead of the application color', () => {
    expect(renderColors({ app: 'firefox', title: 'Movie' }).window).toBe('#654321');
  });

  test.each([
    ['app', { app: 'Chrome', title: 'Firefox docs' }],
    ['title', { app: 'Firefox', title: 'Other docs' }],
  ])('does not match a category outside its selected %s field', (field, windowData) => {
    jest.spyOn(classes, 'loadClasses').mockReturnValue([
      {
        name: ['Browser'],
        rule: { type: 'regex', regex: 'Firefox', select_keys: [field] },
        data: { color: '#abcdef' },
      },
    ]);
    expect(renderColors(windowData).window).toBe('#CCC');
  });

  test.each([
    ['app', { app: 'Firefox', title: 'Other docs' }],
    ['title', { app: 'Chrome', title: 'Firefox docs' }],
  ])('matches a category within its selected %s field', (field, windowData) => {
    jest.spyOn(classes, 'loadClasses').mockReturnValue([
      {
        name: ['Browser'],
        rule: { type: 'regex', regex: 'Firefox', select_keys: [field] },
        data: { color: '#abcdef' },
      },
    ]);
    expect(renderColors(windowData).window).toBe('#abcdef');
  });

  test('respects the existing uncategorized fallback setting', () => {
    expect(renderColors({ app: 'unknown-app', title: 'unmatched' }).window).toBe('#CCC');
    localStorage.useColorFallback = 'true';
    expect(renderColors({ app: 'unknown-app', title: 'unmatched' }).window).toBe(
      getColorFromString('unknown-app\nunmatched')
    );
  });
});
