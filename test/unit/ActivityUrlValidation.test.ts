import { createLocalVue, shallowMount } from '@vue/test-utils';
import BootstrapVue from 'bootstrap-vue';
import { createPinia, setActivePinia } from 'pinia';
import ActivityComponent from '~/views/activity/Activity.vue';

// Tests call Options API members directly, which the Vue constructor type doesn't expose.
const Activity: any = ActivityComponent;

beforeEach(() => {
  setActivePinia(createPinia());
  // Local time, not UTC: the view works in local dates, so a UTC instant would
  // land on a different day east of UTC and make these tests timezone-dependent.
  jest.useFakeTimers().setSystemTime(new Date(2026, 9, 20, 18, 0, 0));
});
afterEach(() => jest.useRealTimers());

function makeVm(periodLength: string, date: string | undefined) {
  const vm: any = {
    periodLength,
    date,
    host: 'test',
    hostParam: 'all',
    subview: 'view',
    currentViewId: 'default',
    $route: {
      path: `/activity/all/${periodLength}/${date}/view/default`,
      query: { category: 'Work' },
    },
    $router: { push: jest.fn() },
    settingsStore: { startOfDay: '04:00' },
    $t: (k: string) => k,
    ...Activity.methods,
  };
  for (const name of [
    'exactInterval',
    'dateRange',
    'invalidRange',
    'unknownUrlPeriod',
    'invalidUrlPeriod',
    'periodLengths',
    'timeperiod',
    '_date',
    'periodIsBrowseable',
    'periodReadableRange',
    'allTimeRange',
    'link_prefix',
  ]) {
    Object.defineProperty(vm, name, { get: () => Activity.computed[name].call(vm) });
  }
  return vm;
}

// ActivityWatch/aw-webui#1328 item 10
describe('Activity URL date and period validation', () => {
  test.each(['2026-02-30', 'garbage', '2026-1-5'])(
    'an invalid :date %p warns and shows today',
    date => {
      const vm = makeVm('day', date);
      expect(vm.invalidUrlPeriod).toBe(true);
      expect(vm._date).toBe('2026-10-20');
      expect(vm.previousPeriod()).toBe('2026-10-19');
    }
  );

  test.each([
    ['week', 'garbage'],
    ['last7d', '2026-02-30'],
  ])('a known :periodLength %p with a bad date keeps its period in links', (period, date) => {
    const vm = makeVm(period, date);
    expect(vm.invalidUrlPeriod).toBe(true);
    expect(vm.link_prefix).toBe(`/activity/all/${period}`);
  });

  test('an unknown :periodLength warns and renders a single day instead of throwing', () => {
    const vm = makeVm('foo', '2026-10-15');
    expect(vm.invalidUrlPeriod).toBe(true);
    expect(vm.timeperiod.length).toEqual([1, 'day']);
    // The day in the URL still applies, so the date picker moves the view.
    expect(vm.periodReadableRange).toBe('2026-10-15—2026-10-16');
    // Previous/Next build day links, otherwise they would keep re-entering `foo`.
    expect(vm.link_prefix).toBe('/activity/all/day');
  });

  test.each(['foo', 'constructor'])('the date picker escapes the unknown period %p', period => {
    const vm = makeVm(period, '2026-10-15');
    vm.setDate('2026-10-10', period);
    expect(vm.$router.push).toHaveBeenCalledWith({
      path: '/activity/all/day/2026-10-10/view/default',
      query: { category: 'Work' },
    });
  });

  test('clicking period usage escapes an unknown period', () => {
    const vm = makeVm('foo', '2026-10-15');
    vm.setUsagePeriod({ start: '2026-10-10T04:00:00', length: [1, 'day'] });
    expect(vm.$router.push).toHaveBeenCalledWith({
      path: '/activity/all/day/2026-10-10/view/default',
      query: { category: 'Work' },
    });
  });

  test('the date picker keeps a supported period and explicit period switches still work', () => {
    const vm = makeVm('last7d', '2026-10-15');
    vm.setDate('2026-10-10', 'last7d');
    expect(vm.$router.push).toHaveBeenLastCalledWith({
      path: '/activity/all/last7d/2026-10-10/view/default',
      query: { category: 'Work' },
    });
    const unknown = makeVm('foo', '2026-10-15');
    unknown.setDate('2026-10-10', 'month');
    expect(unknown.$router.push).toHaveBeenLastCalledWith({
      path: '/activity/all/month/2026-10-01/view/default',
      query: { category: 'Work' },
    });
  });

  test('the unknown-period toolbar selects Day without an empty extended-period pill', async () => {
    const vm = makeVm('foo', '2026-10-15');
    const localVue = createLocalVue();
    localVue.use(BootstrapVue);
    localVue.filter('friendlyduration', value => value);
    // Render the real template, without starting queries or installing its watchers.
    const wrapper = shallowMount(
      { ...Activity, created: [], mounted: [], beforeDestroy: [], watch: {} },
      {
        localVue,
        stubs: ['router-view', 'aw-devonly', 'aw-periodusage', 'icon'],
        propsData: { host: 'test', periodLength: 'foo', date: '2026-10-15' },
        mocks: {
          $t: (k: string) => k,
          $route: { params: {}, query: {}, meta: { subview: 'view' } },
          $router: { push: jest.fn() },
        },
        computed: {
          activityDiagnostic: () => null,
          isMultidevice: () => false,
          views: () => [],
          buckets: () => [],
          hosts: () => [],
          periodusage: () => [],
          timeperiod: () => vm.timeperiod,
        },
      }
    );
    const buttons = wrapper.find('.activity-toolbar b-button-group-stub').findAll('b-button-stub');
    expect(buttons.length).toBe(3);
    expect(buttons.at(0).text()).toBe('activity.periodDay');
    expect(buttons.at(0).attributes('pressed')).toBe('true');
    wrapper.findComponent({ name: 'InputDate' }).vm.$emit('input', '2026-10-10');
    await wrapper.vm.$nextTick();
    expect((wrapper.vm as any).$router.push).toHaveBeenCalledWith({
      path: '/activity/test/day/2026-10-10/view/',
      query: {},
    });
    wrapper.destroy();
  });

  // Object.prototype names are inherited, so a plain `in` check accepted them and
  // the duration lookup then returned Object's constructor instead of a duration.
  test.each(['constructor', 'toString', 'hasOwnProperty'])(
    'the inherited name %p is not treated as a period',
    periodLength => {
      const vm = makeVm(periodLength, '2026-10-15');
      expect(vm.invalidUrlPeriod).toBe(true);
      expect(vm.timeperiod.length).toEqual([1, 'day']);
      expect(vm.link_prefix).toBe('/activity/all/day');
    }
  );

  test.each([
    ['day', '2026-10-15'],
    ['week', '2026-10-15'],
    ['last7d', undefined],
    ['range', '2026-10-01..2026-10-05'],
  ])('a valid %s URL is not flagged', (periodLength, date) => {
    const vm = makeVm(periodLength, date);
    expect(vm.invalidUrlPeriod).toBe(false);
  });
});
