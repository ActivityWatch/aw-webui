import { createLocalVue, mount, Wrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import moment from 'moment';
import SelectableVisualization from '~/components/SelectableVisualization.vue';
import SunburstClock from '~/visualizations/SunburstClock.vue';
import { useActivityStore } from '~/stores/activity';
import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';
import { dateToTimeperiod, timeperiodToStr } from '~/util/timeperiod';
import { getColorFromString } from '~/util/color';

const DATE = '2026-09-01';
const AFK_BUCKET = 'aw-watcher-afk_test';
const WINDOW_BUCKET = 'aw-watcher-window_test';

// Register the actual globally registered child, just as main.js does, without
// importing unrelated charts. Neither target component nor D3 is stubbed.
const localVue = createLocalVue();
localVue.component('aw-sunburst-clock', SunburstClock);

interface ArcDatum {
  depth: number;
  x0: number;
  x1: number;
  y1: number;
  data: { data: { title?: string; status?: string } };
}
type BoundPath = SVGPathElement & { __data__: ArcDatum };

// The clock awaits AFK and then window queries before updating D3 and Vue.
async function flushClock() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe('Sunburst Clock through its mounted visualization caller', () => {
  let wrapper: Wrapper<any>;

  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    if (wrapper) wrapper.destroy();
    document.body.innerHTML = '';
  });

  async function mountClock(startOfDay: string, includeCalendarDate = true) {
    const settings = useSettingsStore();
    settings.startOfDay = startOfDay;
    settings.classes = [
      {
        name: ['Work'],
        rule: { type: 'regex', regex: 'Project Alpha', select_keys: ['title'] },
        data: { color: '#123456' },
      },
    ];
    useCategoryStore().load(settings.classes);
    const timeperiod = dateToTimeperiod(DATE, startOfDay);
    const start = moment(timeperiod.start);
    const sixAM = moment(`${DATE}T06:00:00`);
    useActivityStore().$patch({
      query_options: {
        ...(includeCalendarDate ? { date: DATE } : {}),
        timeperiod,
      },
      buckets: { loaded: true, afk: [AFK_BUCKET], window: [WINDOW_BUCKET] },
      active: { available: true },
      window: { available: true },
    } as any);

    const query = jest.fn(async (_intervals: string[], queries: string[]) => {
      if (queries[0].includes(`query_bucket("${AFK_BUCKET}")`)) {
        return [[{ timestamp: start.toISOString(), duration: 86400, data: { status: 'not-afk' } }]];
      }
      if (queries[0].includes(`query_bucket("${WINDOW_BUCKET}")`)) {
        return [
          [
            {
              timestamp: sixAM.toISOString(),
              duration: 1800,
              data: { app: 'editor', title: 'Project Alpha' },
            },
          ],
        ];
      }
      throw new Error(`Unexpected clock query: ${queries.join('\n')}`);
    });

    wrapper = mount(SelectableVisualization, {
      localVue,
      attachTo: document.body,
      propsData: { type: 'sunburst_clock', editable: false },
      mocks: { $aw: { query } },
      stubs: ['b-alert', 'icon'],
    });
    await flushClock();
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent(SunburstClock).exists()).toBe(true);
    expect(wrapper.find('#container path').exists()).toBe(true);
    return { query, timeperiod };
  }

  function windowArc(): BoundPath {
    const paths = Array.from(wrapper.element.querySelectorAll<BoundPath>('#container path'));
    const path = paths.find(p => p.__data__.data.data.title === 'Project Alpha');
    expect(path).toBeDefined();
    return path;
  }

  test.each(['00:00', '04:00', '04:30'])(
    'queries both buckets over the selected %s reporting day, not calendar midnight',
    async startOfDay => {
      const { query, timeperiod } = await mountClock(startOfDay);
      expect(query).toHaveBeenCalledTimes(2);
      // The activity store retains a calendar date AND its resolved reporting
      // interval. Passing only date to the child silently discards the offset.
      expect(query.mock.calls.map(([intervals]) => intervals)).toEqual([
        [timeperiodToStr(timeperiod)],
        [timeperiodToStr(timeperiod)],
      ]);
      expect(query.mock.calls.map(([, queries]) => queries)).toEqual([
        [`RETURN = flood(query_bucket("${AFK_BUCKET}"));`],
        [`RETURN = flood(query_bucket("${WINDOW_BUCKET}"));`],
      ]);
    }
  );

  test.each(['00:00', '04:00', '04:30'])(
    'renders 06:00 at pi/2 with real SVG clock ticks for a %s reporting boundary',
    async startOfDay => {
      // The caller also accepts query options with only a timeperiod. This
      // exercises the offset reaching D3 rather than hiding rotation behind
      // the calendar-date query bug tested above.
      await mountClock(startOfDay, false);
      const path = windowArc();
      expect(path.__data__.x0).toBeCloseTo(Math.PI / 2, 8);
      expect(path.__data__.x1).toBeCloseTo((2 * Math.PI * 6.5) / 24, 8);

      // Inspect the generated arc, not just the bound hierarchy data: D3's
      // angular origin is twelve o'clock, so 06:00 must start due east.
      const startPoint = /^M([\d.eE+-]+),([\d.eE+-]+)/.exec(path.getAttribute('d'));
      expect(startPoint).not.toBeNull();
      expect(Number(startPoint[1])).toBeCloseTo(Math.sqrt(path.__data__.y1), 2);
      expect(Number(startPoint[2])).toBeCloseTo(0, 2);

      const tickLabels = Array.from(
        wrapper.element.querySelectorAll<SVGTextElement>('#container text')
      );
      for (const [label, x, y] of [
        ['00:00', 0, -135],
        ['06:00', 130, 5],
        ['12:00', 0, 145],
        ['18:00', -130, 5],
      ] as [string, number, number][]) {
        const tick = tickLabels.find(t => t.textContent === label);
        expect(tick).toBeDefined();
        expect(Number(tick.getAttribute('x'))).toBeCloseTo(x, 8);
        expect(Number(tick.getAttribute('y'))).toBeCloseTo(y, 8);
      }
      const lines = Array.from(wrapper.element.querySelectorAll<SVGLineElement>('#container line'));
      expect(
        lines.some(
          line =>
            Math.abs(Number(line.getAttribute('x1')) - 170) < 1e-8 &&
            Math.abs(Number(line.getAttribute('y1'))) < 1e-8 &&
            Math.abs(Number(line.getAttribute('x2')) - 155) < 1e-8 &&
            Math.abs(Number(line.getAttribute('y2'))) < 1e-8
        )
      ).toBe(true);

      if (startOfDay !== '00:00') {
        const boundary = tickLabels.find(t => t.textContent === `${startOfDay} ☀`);
        expect(boundary).toBeDefined();
        const [hour, minute] = startOfDay.split(':').map(Number);
        const angle = (2 * Math.PI * (hour + minute / 60)) / 24 - Math.PI / 2;
        expect(Number(boundary.getAttribute('x'))).toBeCloseTo(130 * Math.cos(angle), 8);
        expect(Number(boundary.getAttribute('y'))).toBeCloseTo(5 + 140 * Math.sin(angle), 8);
      }
    }
  );

  test('retains category colors on real window arcs and status colors on the parent ring', async () => {
    await mountClock('04:30');
    expect(windowArc().style.fill).toBe('#123456');
    const statusPath = Array.from(
      wrapper.element.querySelectorAll<BoundPath>('#container path')
    ).find(p => p.__data__.data.data.status === 'not-afk');
    expect(statusPath).toBeDefined();
    expect(statusPath.style.fill).toBe(getColorFromString('not-afk'));
  });
});
