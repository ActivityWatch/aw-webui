import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SunburstCategories from '~/visualizations/SunburstCategories.vue';
import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';

describe('SunburstCategories', () => {
  beforeEach(() => {
    setActivePinia(createPinia());

    useSettingsStore().theme = 'light';
    useCategoryStore().load([
      {
        name: ['Work'],
        rule: { type: 'none' },
        data: { color: '#336699' },
      },
      {
        name: ['Work', 'Code'],
        rule: { type: 'none' },
        data: { color: '#669933' },
      },
      {
        name: ['Code'],
        rule: { type: 'none' },
        data: { color: '#669933' },
      },
    ]);
  });

  test('renders the sunburst graph', async () => {
    const wrapper = mount(SunburstCategories, {
      attachTo: document.body,
      props: {
        data: {
          name: 'All',
          children: [
            {
              name: 'Work',
              children: [{ name: 'Code', size: 3600 }],
            },
          ],
        },
      },
    });

    await wrapper.vm.$nextTick();

    expect(wrapper.find('svg').exists()).toBe(true);
    expect(wrapper.findAll('path').length).toBeGreaterThan(0);

    wrapper.unmount();
  });

  test('renders nothing while the data is loading', () => {
    const wrapper = mount(SunburstCategories, { props: { data: null } });
    expect(wrapper.findAll('path')).toHaveLength(0);
    wrapper.unmount();
  });
});
