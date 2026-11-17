/**
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Calendar from '~/visualizations/Calendar.vue';
import { useCategoryStore } from '~/stores/categories';
import { i18n } from '~/i18n';

beforeEach(() => setActivePinia(createPinia()));

const stubs = ['b-form', 'b-form-group', 'b-checkbox'];

test('renders an empty FullCalendar safely when fitting without a selected bucket', async () => {
  const wrapper: any = mount(Calendar, { propsData: { buckets: [] }, stubs });
  try {
    await wrapper.setData({ fitToActive: true });
    expect(wrapper.vm.events).toEqual([]);
    expect(wrapper.findAll('.fc-timegrid-slot[data-time="00:00:00"]').length).toBeGreaterThan(0);
    expect(wrapper.vm.calendarOptions.slotMaxTime).toBe('24:00:00');
  } finally {
    wrapper.destroy();
  }
});

test('renders fitted day/week grids and recovers when the selected bucket disappears', async () => {
  const wrapper: any = mount(Calendar, {
    propsData: {
      buckets: [
        {
          id: 'window',
          type: 'currentwindow',
          events: [
            {
              timestamp: '2026-09-10T10:15:00',
              duration: 300,
              data: { app: 'Test', title: 'Short event' },
            },
          ],
        },
      ],
    },
    stubs,
  });
  try {
    await wrapper.setData({ selectedBucket: 'window', fitToActive: true });
    const api = wrapper.vm.$refs.fullCalendar.getApi();
    api.gotoDate('2026-09-10');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.fc-event-title').text()).toContain('Test');
    expect(wrapper.vm.calendarOptions.slotMaxTime).toBe('11:00:00');
    expect(wrapper.findAll('.fc-timegrid-slot[data-time="10:30:00"]').length).toBeGreaterThan(0);
    await wrapper.setData({ view: 'timeGridWeek' });
    expect(api.view.type).toBe('timeGridWeek');
    expect(wrapper.find('.fc-event-title').exists()).toBe(true);
    await wrapper.setProps({ buckets: [] });
    expect(wrapper.vm.events).toEqual([]);
    expect(wrapper.vm.calendarOptions.slotMaxTime).toBe('24:00:00');
  } finally {
    wrapper.destroy();
  }
});

test('renders both daily segments of an overnight event in the week grid', async () => {
  const wrapper: any = mount(Calendar, {
    propsData: {
      buckets: [
        {
          id: 'window',
          type: 'currentwindow',
          events: [
            {
              timestamp: '2026-09-10T23:30:00',
              duration: 3600,
              data: { app: 'Test', title: 'Overnight' },
            },
          ],
        },
      ],
    },
    stubs,
  });
  try {
    await wrapper.setData({ selectedBucket: 'window', fitToActive: true, view: 'timeGridWeek' });
    wrapper.vm.$refs.fullCalendar.getApi().gotoDate('2026-09-10');
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.calendarOptions.slotMinTime).toBe('00:00:00');
    expect(wrapper.vm.calendarOptions.slotMaxTime).toBe('24:00:00');
    expect(wrapper.findAll('.fc-timegrid-event')).toHaveLength(2);
  } finally {
    wrapper.destroy();
  }
});

describe('categorized calendar (#200)', () => {
  const windowBucket = {
    id: 'window',
    type: 'currentwindow',
    events: [{ timestamp: '2026-09-10T10:15:00', duration: 300, data: { app: 'Raw', title: 'x' } }],
  };
  const categorized = [
    {
      timestamp: '2026-09-10T09:00:00',
      duration: 1800,
      data: { $category: ['Work', 'Programming'] },
    },
    { timestamp: '2026-09-10T09:30:00', duration: 0, data: { $category: ['Work'] } },
  ];

  test('defaults to merged category intervals, coloured from the nearest coloured parent', () => {
    useCategoryStore().classes = [
      { id: 1, name: ['Work'], rule: { type: 'none' }, data: { color: '#123456' } },
      { id: 2, name: ['Work', 'Programming'], rule: { type: 'none' } },
    ] as any;
    const wrapper: any = mount(Calendar, {
      propsData: { buckets: [windowBucket], categorizedEvents: categorized },
      stubs,
    });
    try {
      expect(wrapper.vm.activeSource).toBe('category');
      // Zero-duration intervals are dropped; raw bucket events are not mixed in.
      expect(wrapper.vm.events).toHaveLength(1);
      expect(wrapper.vm.events[0]).toMatchObject({
        title: 'Work > Programming',
        backgroundColor: '#123456',
      });
    } finally {
      wrapper.destroy();
    }
  });

  test('falls back to raw bucket events when no categorized stream is available', async () => {
    const wrapper: any = mount(Calendar, {
      propsData: { buckets: [windowBucket], categorizedEvents: [] },
      stubs,
    });
    try {
      expect(wrapper.vm.activeSource).toBe('bucket');
      // The bucket picker is shown even though no explicit source was chosen.
      expect(wrapper.find('select option[value="window"]').exists()).toBe(true);
      await wrapper.setData({ selectedBucket: 'window' });
      expect(wrapper.vm.events.map(e => e.title)).toEqual(['Raw']);
      // Category mode is chosen automatically once the stream arrives.
      await wrapper.setProps({ categorizedEvents: categorized });
      expect(wrapper.vm.events[0].title).toBe('Work > Programming');
      expect(wrapper.find('select option[value="window"]').exists()).toBe(false);
      // An explicit raw-bucket choice from the source picker sticks.
      const sourceSelect = wrapper.findAll('select').at(0);
      sourceSelect.element.value = 'bucket';
      await sourceSelect.trigger('change');
      expect(wrapper.vm.events.map(e => e.title)).toEqual(['Raw']);
    } finally {
      wrapper.destroy();
    }
  });

  test('titles use translated labels for default category names', () => {
    i18n.locale = 'sv';
    const wrapper: any = mount(Calendar, {
      propsData: { buckets: [windowBucket], categorizedEvents: categorized },
      stubs,
    });
    try {
      expect(wrapper.vm.events[0].title).toBe('Arbete > Programmering');
    } finally {
      wrapper.destroy();
      i18n.locale = 'en';
    }
  });

  test('falls back to raw buckets when no categorized interval is renderable', () => {
    const wrapper: any = mount(Calendar, {
      propsData: {
        buckets: [windowBucket],
        categorizedEvents: [
          { timestamp: '2026-09-10T09:30:00', duration: 0, data: { $category: ['Work'] } },
          { timestamp: '2026-09-10T09:30:00', duration: 60, data: {} },
        ],
      },
      stubs,
    });
    try {
      expect(wrapper.vm.hasCategories).toBe(false);
      expect(wrapper.vm.activeSource).toBe('bucket');
    } finally {
      wrapper.destroy();
    }
  });
});
