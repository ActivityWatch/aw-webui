import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SunburstCategories from '~/visualizations/SunburstCategories.vue';
import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';

jest.mock('vue-d3-sunburst/dist/vue-d3-sunburst.css', () => ({}));

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

  test('renders the vue-d3-sunburst graph with the overridden d3-color dependency', async () => {
    const wrapper = mount(SunburstCategories, {
      attachTo: document.body,
      propsData: {
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

    wrapper.destroy();
  });

  describe('root ("All") color', () => {
    const rootColor = theme => {
      useSettingsStore().theme = theme;
      return SunburstCategories.methods.colorfunc('All');
    };
    // Mimic how App.vue/Theme.vue apply the dark theme: by adding/removing
    // the dark stylesheet <link> in the document head.
    const setDarkApplied = dark => {
      document.querySelector('head link[href="/dark.css"]')?.remove();
      if (dark) {
        const link = document.createElement('link');
        link.href = '/dark.css';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
    };
    afterEach(() => setDarkApplied(false));

    test('is light in light theme and dark in dark theme', () => {
      expect(rootColor('light')).toBe('#fff');
      expect(rootColor('dark')).toBe('#333');
    });

    test("follows the theme applied to the page when theme is 'auto'", () => {
      setDarkApplied(false);
      expect(rootColor('auto')).toBe('#fff');
      setDarkApplied(true);
      expect(rootColor('auto')).toBe('#333');
    });
  });
});
