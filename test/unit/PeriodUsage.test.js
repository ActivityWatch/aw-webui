import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import moment from 'moment';
import PeriodUsage from '~/visualizations/PeriodUsage.vue';
import periodusage from '~/visualizations/periodusage';
import Activity from '~/views/activity/Activity.vue';
import { useActivityStore } from '~/stores/activity';
import { timeperiodToStr } from '~/util/timeperiod';

beforeEach(() => {
  setActivePinia(createPinia());
  jest.useFakeTimers().setSystemTime(new Date('2026-09-10T02:00:00'));
});
afterEach(() => jest.useRealTimers());

const period = (start, periodLength = [1, 'day']) => ({ start, length: periodLength });
const entry = (p, events = []) => ({ period: p, events });

test.each([
  [1, 'day'],
  [1, 'week'],
  [1, 'month'],
  [7, 'days'],
  [30, 'days'],
])('store preserves boundaries and empty entries for %s %s', (count, unit) => {
  const store = useActivityStore();
  const p = period('2026-09-01T04:00:00', [count, unit]);
  const events = [{ timestamp: '2026-09-02T12:00:00', duration: 300, data: { status: 'not-afk' } }];
  store.active.history[timeperiodToStr(p)] = events;
  const bars = store.getActiveHistoryAroundTimeperiod(p);
  expect(bars).toHaveLength(31);
  expect(moment(bars[15].period.start).valueOf()).toBe(moment(p.start).valueOf());
  expect(bars[15].events).toEqual(events);
  expect(bars[0].events).toEqual([]);
  expect(bars[0].period.length).toEqual([count, unit]);
});

test('renders provided data on mount, sums events, and emits the original period', () => {
  const p = period('2026-09-09T04:00:00');
  const wrapper = mount(PeriodUsage, {
    propsData: {
      periodusage_arr: [
        entry(p, [
          { timestamp: '2026-09-10T01:00:00', duration: 60, data: { status: 'not-afk' } },
          { timestamp: '2026-09-09T12:00:00', duration: 120, data: { status: 'not-afk' } },
        ]),
      ],
    },
  });
  try {
    expect(wrapper.find('rect title').text()).toBe('2026-09-09\n3m 0s');
    expect(wrapper.findAll('line')).toHaveLength(1);
    wrapper.find('rect').element.dispatchEvent(new MouseEvent('click'));
    expect(wrapper.emitted('update')[0][0]).toEqual(p);
    for (const attr of ['x', 'y', 'width', 'height']) {
      expect(Number.isFinite(parseFloat(wrapper.find('rect').attributes(attr)))).toBe(true);
    }
  } finally {
    wrapper.destroy();
  }
});

test('empty periods remain clickable and Today is end-exclusive and refreshed', async () => {
  const current = period('2026-09-03T04:00:00', [7, 'days']);
  const wrapper = mount(PeriodUsage, { propsData: { periodusage_arr: [entry(current)] } });
  try {
    expect(wrapper.find('rect title').text()).toContain('2026-09-03 – 2026-09-09');
    expect(wrapper.findAll('line')).toHaveLength(1);
    jest.setSystemTime(new Date('2026-09-10T04:00:00'));
    await wrapper.setProps({ periodusage_arr: [entry({ ...current })] });
    expect(wrapper.findAll('line')).toHaveLength(0);
    wrapper.find('rect').element.dispatchEvent(new MouseEvent('click'));
    expect(wrapper.emitted('update')[0][0]).toEqual(current);
    await wrapper.setProps({ periodusage_arr: [] });
    expect(wrapper.text()).toBe('No data');
    expect(wrapper.findAll('rect')).toHaveLength(0);
  } finally {
    wrapper.destroy();
  }
});

test.each([
  ['day', 1, '2026-09-01'],
  ['week', 1, '2026-09-01'],
  ['month', 1, '2026-09-01'],
  ['last7d', 7, '2026-09-07'],
  ['last30d', 30, '2026-09-30'],
])('%s click uses the correct route anchor', (periodLength, count, expected) => {
  const vm = { periodLength, setDate: jest.fn() };
  Activity.methods.setUsagePeriod.call(vm, period('2026-09-01T04:00:00', [count, 'days']));
  expect(vm.setDate).toHaveBeenCalledWith(expected);
});

test.each(['last7d', 'last30d'])('%s route retains the supplied anchor', periodLength => {
  const vm = {
    periodLength,
    settingsStore: { startOfDay: '04:00' },
    periodIsBrowseable: false,
    host: 'host',
    subview: 'view',
    currentViewId: 'default',
    $route: { path: '', query: { test: 'value' } },
    $router: { push: jest.fn() },
  };
  Activity.methods.setDate.call(vm, '2026-09-07');
  expect(vm.$router.push).toHaveBeenCalledWith({
    path: `/activity/host/${periodLength}/2026-09-07/view/default`,
    query: { test: 'value' },
  });
});

// Direct renderer checks for the degenerate inputs that produced invalid SVG:
// padding of 100/(count-1) was Infinity for a single bar, and a zero maximum
// made every height NaN.
describe('renderer geometry', () => {
  function render(entries) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(el);
    periodusage.create(el);
    periodusage.update(el, entries, jest.fn());
    return el;
  }

  function expectFinite(el) {
    for (const rect of el.querySelectorAll('rect')) {
      for (const name of ['x', 'y', 'width', 'height']) {
        const raw = rect.getAttribute(name);
        expect(raw).not.toBeNull();
        expect(raw).not.toMatch(/NaN|Infinity/);
        expect(Number.isFinite(parseFloat(raw))).toBe(true);
      }
      expect(parseFloat(rect.getAttribute('width'))).toBeGreaterThan(0);
      expect(parseFloat(rect.getAttribute('height'))).toBeGreaterThanOrEqual(0);
    }
  }

  const active = (p, duration) => ({
    period: p,
    events: [{ timestamp: p.start, duration, data: { status: 'not-afk' } }],
  });

  test('a single bar produces finite geometry', () => {
    const el = render([active(period('2026-09-10T04:00:00'), 100)]);
    expect(el.querySelectorAll('rect')).toHaveLength(1);
    expectFinite(el);
  });

  test('all-zero durations produce finite geometry', () => {
    const el = render([
      active(period('2026-09-08T04:00:00'), 0),
      active(period('2026-09-09T04:00:00'), 0),
      active(period('2026-09-10T04:00:00'), 0),
    ]);
    expect(el.querySelectorAll('rect')).toHaveLength(3);
    expectFinite(el);
  });

  test('a single all-zero bar produces finite geometry', () => {
    const el = render([active(period('2026-09-10T04:00:00'), 0)]);
    expect(el.querySelectorAll('rect')).toHaveLength(1);
    expectFinite(el);
  });

  test('empty entries still render a bar with finite geometry', () => {
    const el = render([entry(period('2026-09-09T04:00:00'))]);
    expect(el.querySelectorAll('rect')).toHaveLength(1);
    expectFinite(el);
  });

  test.each([[[]], [null], [undefined]])('%p renders the No data status', entries => {
    const el = render(entries);
    expect(el.textContent).toContain('No data');
    expect(el.querySelectorAll('rect')).toHaveLength(0);
  });

  test('all active events in a period are summed, not just the first', () => {
    const p = period('2026-09-10T04:00:00');
    const el = render([
      {
        period: p,
        events: [
          { timestamp: p.start, duration: 60, data: { status: 'not-afk' } },
          { timestamp: p.start, duration: 30, data: { status: 'not-afk' } },
          { timestamp: p.start, duration: 999, data: { status: 'afk' } },
        ],
      },
    ]);
    expect(el.querySelector('title').textContent).toContain('1m 30s');
  });

  test('re-rendering replaces stale bars and stale Today markers', () => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(el);
    periodusage.create(el);

    const todays = () =>
      Array.from(el.querySelectorAll('text')).filter(t => t.textContent === 'Today').length;

    // now is 2026-09-10T02:00, which belongs to the activity day starting 09-09.
    periodusage.update(
      el,
      [active(period('2026-09-09T04:00:00'), 100), active(period('2026-09-08T04:00:00'), 50)],
      jest.fn()
    );
    expect(el.querySelectorAll('rect')).toHaveLength(2);
    expect(todays()).toBe(1);

    periodusage.update(el, [active(period('2020-01-01T04:00:00'), 100)], jest.fn());
    expect(el.querySelectorAll('rect')).toHaveLength(1);
    expect(todays()).toBe(0);
  });
});
