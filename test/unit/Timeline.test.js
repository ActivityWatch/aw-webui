import Timeline from '~/views/Timeline.vue';
import { i18n } from '~/i18n';

const mockBucketsStore = {
  getBucketsWithEvents: jest.fn(),
};
const mockCategoryStore = {
  category_sets: [],
  classes: [],
  load: jest.fn(),
};

jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => mockBucketsStore,
}));

jest.mock('~/stores/categories', () => ({
  useCategoryStore: () => mockCategoryStore,
}));

function makeVm(overrides = {}) {
  return {
    daterange: [{ format: () => 'start' }, { format: () => 'end' }],
    all_buckets: null,
    hosts: [],
    clients: [],
    buckets: null,
    filter_hostnames: [],
    filter_clients: [],
    host_filter_initialized: true,
    client_filter_initialized: true,
    filter_duration_min: null,
    filter_duration_max: null,
    filter_afk: false,
    filter_merge_similar: false,
    filter_categories: [],
    category_filter_initialized: false,
    all_categories_selected: false,
    ...overrides,
  };
}

describe('Timeline filters', () => {
  beforeEach(() => {
    mockBucketsStore.getBucketsWithEvents.mockReset();
    mockCategoryStore.load.mockReset();
    mockCategoryStore.category_sets = [];
    mockCategoryStore.classes = [];
  });

  test('loads categories when the store has not been initialized', () => {
    Timeline.mounted.call({});

    expect(mockCategoryStore.load).toHaveBeenCalledTimes(1);
  });

  test('does not reload an already initialized category store', () => {
    mockCategoryStore.category_sets = [{ id: 'default', categories: [] }];

    Timeline.mounted.call({});

    expect(mockCategoryStore.load).not.toHaveBeenCalled();
  });

  test('filters buckets by any selected host and client', async () => {
    const buckets = [
      { hostname: 'host-a', client: 'client-1', events: [] },
      { hostname: 'host-b', client: 'client-2', events: [] },
      { hostname: 'host-c', client: 'client-3', events: [] },
    ];
    mockBucketsStore.getBucketsWithEvents.mockResolvedValue(buckets);

    const vm = makeVm({
      filter_hostnames: ['host-a', 'host-b'],
      filter_clients: ['client-2', 'client-3'],
    });

    await Timeline.methods.getBuckets.call(vm);

    expect(vm.buckets).toEqual([buckets[1]]);
  });

  test('filters events by both minimum and maximum duration', async () => {
    const buckets = [
      {
        hostname: 'host-a',
        client: 'client-1',
        events: [{ duration: 1 }, { duration: 5 }, { duration: 10 }, { duration: 20 }],
      },
    ];
    mockBucketsStore.getBucketsWithEvents.mockResolvedValue(buckets);

    const vm = makeVm({
      filter_hostnames: ['host-a'],
      filter_clients: ['client-1'],
      filter_duration_min: 5,
      filter_duration_max: 10,
    });

    await Timeline.methods.getBuckets.call(vm);

    expect(vm.buckets[0].events.map(event => event.duration)).toEqual([5, 10]);
  });

  test('filters events with only one duration boundary', async () => {
    const buckets = [
      {
        hostname: 'host-a',
        client: 'client-1',
        events: [{ duration: 1 }, { duration: 5 }, { duration: 10 }],
      },
    ];
    mockBucketsStore.getBucketsWithEvents.mockResolvedValue(buckets);

    const vm = makeVm({
      filter_hostnames: ['host-a'],
      filter_clients: ['client-1'],
      filter_duration_min: null,
      filter_duration_max: 5,
    });

    await Timeline.methods.getBuckets.call(vm);

    expect(vm.buckets[0].events.map(event => event.duration)).toEqual([1, 5]);
  });

  test('detects an invalid duration range after unit conversion', () => {
    const vm = {
      pending_filter_duration_min: 2,
      pending_filter_duration_min_unit: 'minutes',
      pending_filter_duration_max: 30,
      pending_filter_duration_max_unit: 'seconds',
      normalizeDuration: Timeline.methods.normalizeDuration,
      durationUnitFactor: Timeline.methods.durationUnitFactor,
    };

    expect(Timeline.computed.duration_range_invalid.call(vm)).toBe(true);
  });

  test('detects negative duration boundaries before normalization', () => {
    const values = [
      [-1, null],
      [null, -1],
      [-1, -2],
    ];

    values.forEach(([min, max]) => {
      const vm = {
        pending_filter_duration_min: min,
        pending_filter_duration_max: max,
      };

      expect(Timeline.computed.duration_range_has_negative.call(vm)).toBe(true);
    });
  });

  test('checks the duration range only when confirming', () => {
    const vm = {
      duration_range_error_visible: false,
      duration_range_invalid: true,
    };

    Timeline.methods.applyFilterChanges.call(vm);

    expect(vm.duration_range_error_visible).toBe(true);
  });

  test('checks negative duration boundaries only when confirming', () => {
    const vm = {
      duration_range_error_visible: false,
      duration_range_has_negative: true,
      duration_range_invalid: false,
    };

    Timeline.methods.applyFilterChanges.call(vm);

    expect(vm.duration_range_error_visible).toBe(true);
  });

  test('resets pending filters to defaults without changing applied filters', () => {
    const vm = {
      hosts: ['host-a', 'host-b'],
      clients: ['client-a'],
      category_options: [{ value: ['Work'] }, { value: ['Personal'] }],
      pending_filter_hostnames: ['host-a'],
      pending_filter_clients: [],
      pending_filter_duration_min: 5,
      pending_filter_duration_max: 10,
      pending_filter_duration_min_unit: 'minutes',
      pending_filter_duration_max_unit: 'hours',
      pending_filter_afk: true,
      pending_filter_merge_similar: true,
      pending_filter_categories: [['Work']],
      duration_range_error_visible: true,
    };

    Timeline.methods.resetFilterChanges.call(vm);

    expect(vm.pending_filter_hostnames).toEqual(['host-a', 'host-b']);
    expect(vm.pending_filter_clients).toEqual(['client-a']);
    expect(vm.pending_filter_duration_min).toBeNull();
    expect(vm.pending_filter_duration_max).toBeNull();
    expect(vm.pending_filter_duration_min_unit).toBe('seconds');
    expect(vm.pending_filter_duration_max_unit).toBe('seconds');
    expect(vm.pending_filter_afk).toBe(false);
    expect(vm.pending_filter_merge_similar).toBe(false);
    expect(vm.pending_filter_categories).toEqual([['Work'], ['Personal']]);
    expect(vm.duration_range_error_visible).toBe(false);
  });

  test('keeps the initial timeline window while filters are initialized', () => {
    const scheduleBucketsRefresh = jest.fn();
    const vm = {
      is_initial_timeline_load: true,
      updateTimelineWindow: true,
      scheduleBucketsRefresh,
    };

    Timeline.methods.handleAppliedFilterChange.call(vm);

    expect(vm.updateTimelineWindow).toBe(true);
    expect(scheduleBucketsRefresh).not.toHaveBeenCalled();

    vm.is_initial_timeline_load = false;
    Timeline.methods.handleAppliedFilterChange.call(vm);

    expect(vm.updateTimelineWindow).toBe(false);
    expect(scheduleBucketsRefresh).toHaveBeenCalledTimes(1);
  });

  test('shows no buckets when host and client selections are empty', async () => {
    const buckets = [
      { hostname: 'host-a', client: 'client-1', events: [] },
      { hostname: 'host-b', client: 'client-2', events: [] },
    ];
    mockBucketsStore.getBucketsWithEvents.mockResolvedValue(buckets);

    const vm = makeVm();

    await Timeline.methods.getBuckets.call(vm);

    expect(vm.buckets).toEqual([]);
  });

  test('shows no buckets when all categories are unchecked', async () => {
    const buckets = [{ hostname: 'host-a', client: 'client-1', events: [{ duration: 10 }] }];
    mockBucketsStore.getBucketsWithEvents.mockResolvedValue(buckets);

    const vm = makeVm({
      filter_hostnames: ['host-a'],
      filter_clients: ['client-1'],
      filter_categories: [],
      category_filter_initialized: true,
      all_categories_selected: false,
    });

    await Timeline.methods.getBuckets.call(vm);

    expect(vm.buckets).toEqual([]);
  });

  test('selects or clears all hosts with the ALL checkbox', () => {
    const vm = {
      hosts: ['host-a', 'host-b'],
      pending_filter_hostnames: ['host-a'],
      all_pending_hosts_selected: false,
    };

    Timeline.methods.toggleAllPendingHosts.call(vm);
    expect(vm.pending_filter_hostnames).toEqual(['host-a', 'host-b']);

    vm.all_pending_hosts_selected = true;
    Timeline.methods.toggleAllPendingHosts.call(vm);
    expect(vm.pending_filter_hostnames).toEqual([]);
  });

  test('does not replace unchanged all host and client selections', async () => {
    const buckets = [{ hostname: 'host-a', client: 'client-1', events: [] }];
    mockBucketsStore.getBucketsWithEvents.mockResolvedValue(buckets);

    const vm = makeVm({
      hosts: ['host-a'],
      clients: ['client-1'],
      filter_hostnames: ['host-a'],
      filter_clients: ['client-1'],
      host_filter_initialized: true,
      client_filter_initialized: true,
      all_hosts_selected: true,
      all_clients_selected: true,
    });

    await Timeline.methods.getBuckets.call(vm);
    const hostSelection = vm.filter_hostnames;
    const clientSelection = vm.filter_clients;
    await Timeline.methods.getBuckets.call(vm);

    expect(vm.filter_hostnames).toBe(hostSelection);
    expect(vm.filter_clients).toBe(clientSelection);
  });

  test('summarizes multi-selection counts in the filter title', () => {
    const summary = Timeline.computed.filter_summary.call({
      filter_hostnames: ['host-a', 'host-b'],
      filter_clients: ['client-1', 'client-2', 'client-3'],
      filter_duration_min: null,
      filter_duration_max: null,
      filter_afk: false,
      filter_merge_similar: false,
      filter_categories: [['Work'], ['Personal']],
      all_hosts_selected: false,
      all_clients_selected: false,
      all_categories_selected: false,
      $tc: (key, count, params) => {
        const labels = {
          'timeline.filters.hostCount': `${params.count} Hosts`,
          'timeline.filters.clientCount': `${params.count} Clients`,
          'timeline.filters.categoryCount': `${params.count} Categories`,
        };
        return labels[key] || `${count}`;
      },
    });

    expect(summary).toBe('2 Hosts, 3 Clients, 2 Categories');
  });

  test('uses the correct plural forms for Russian and Ukrainian filter counts', () => {
    const previousLocale = i18n.locale;
    const expected = {
      ru: ['1 хост', '2 хоста', '5 хостов'],
      uk: ['1 хост', '2 хости', '5 хостів'],
    };

    Object.entries(expected).forEach(([locale, forms]) => {
      i18n.locale = locale;
      expect(i18n.tc('timeline.filters.hostCount', 1, { count: 1 })).toBe(forms[0]);
      expect(i18n.tc('timeline.filters.hostCount', 2, { count: 2 })).toBe(forms[1]);
      expect(i18n.tc('timeline.filters.hostCount', 5, { count: 5 })).toBe(forms[2]);
    });

    i18n.locale = previousLocale;
  });

  test('toggles category selections without losing other selections', () => {
    const vm = {
      pending_filter_categories: [['Work']],
      isPendingCategorySelected: Timeline.methods.isPendingCategorySelected,
    };

    Timeline.methods.togglePendingCategory.call(vm, ['Personal']);
    expect(vm.pending_filter_categories).toEqual([['Work'], ['Personal']]);

    Timeline.methods.togglePendingCategory.call(vm, ['Work']);
    expect(vm.pending_filter_categories).toEqual([['Personal']]);
  });
});
