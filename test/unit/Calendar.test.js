/**
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
import { mount } from '@vue/test-utils';
import Calendar from '~/visualizations/Calendar.vue';

const stubs = ['b-form', 'b-form-group', 'b-checkbox'];

test('renders an empty FullCalendar safely when fitting without a selected bucket', async () => {
  const wrapper = mount(Calendar, { propsData: { buckets: [] }, stubs });
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
  const wrapper = mount(Calendar, {
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
  const wrapper = mount(Calendar, {
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
