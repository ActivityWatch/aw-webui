import { mount } from '@vue/test-utils';
import EventList from '~/visualizations/EventList.vue';

const event = {
  timestamp: '2026-10-31T12:00:00Z',
  duration: 12,
  data: { title: 'Code', app: 'Vim' },
};

function mountList(events: unknown) {
  return mount(EventList, {
    propsData: { events },
    stubs: {
      'event-editor': true,
      'b-card': { template: '<div class="card"><slot name="header" /><slot /></div>' },
      'b-button': true,
      'b-btn': true,
      icon: true,
    },
    filters: {
      friendlytime: v => String(v),
      friendlyduration: v => String(v),
    },
  });
}

describe('EventList result shape', () => {
  test('renders an ordinary event array', () => {
    const wrapper = mountList([event]);
    try {
      expect(wrapper.text()).toContain('Code');
      expect(wrapper.findAll('li')).toHaveLength(1);
    } finally {
      wrapper.destroy();
    }
  });

  test('renders an empty event array without crashing', () => {
    const wrapper = mountList([]);
    try {
      expect(wrapper.findAll('li')).toHaveLength(0);
      expect(wrapper.text()).toContain('0');
    } finally {
      wrapper.destroy();
    }
  });

  test.each([42, { total: 42 }, null])('does not throw when given non-array result %p', value => {
    const wrapper = mountList(value);
    try {
      expect(wrapper.findAll('li')).toHaveLength(0);
    } finally {
      wrapper.destroy();
    }
  });

  test('does not throw for a primitive array', () => {
    const wrapper = mountList([1, 2]);
    try {
      expect(wrapper.findAll('li')).toHaveLength(2);
    } finally {
      wrapper.destroy();
    }
  });
});
