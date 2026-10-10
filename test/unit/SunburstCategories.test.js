import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SunburstCategories from '~/visualizations/SunburstCategories.vue';
import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';
import { DARK_THEME_HREF } from '~/util/theme';

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

  describe('root ("All") color', () => {
    const rootColor = theme => {
      useSettingsStore().theme = theme;
      return SunburstCategories.methods.colorfunc('All');
    };
    // Mimic how App.vue/Theme.vue apply the dark theme: by adding/removing
    // the dark stylesheet <link> in the document head. Shares DARK_THEME_HREF
    // with production so this tracks the real stylesheet path, not a copy.
    const setDarkApplied = dark => {
      document.querySelector(`head link[href="${DARK_THEME_HREF}"]`)?.remove();
      if (dark) {
        const link = document.createElement('link');
        link.href = DARK_THEME_HREF;
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

  test('truncates labels that would overflow their ring', async () => {
    const longName = 'ActivityWatch Development';
    const wrapper = mount(SunburstCategories, {
      props: {
        data: {
          name: 'All',
          children: [{ name: 'Work', children: [{ name: longName, size: 3600 }] }],
        },
      },
    });
    await wrapper.vm.$nextTick();

    const labels = wrapper.findAll('text.sunburst-label').map(w => w.text());
    const truncated = labels.find(l => l.endsWith('…'));
    expect(truncated).toBeDefined();
    expect(longName.startsWith(truncated.slice(0, -1))).toBe(true);
    wrapper.unmount();
  });

  test('renders nothing while the data is loading', () => {
    const wrapper = mount(SunburstCategories, { props: { data: null } });
    expect(wrapper.findAll('path')).toHaveLength(0);
    wrapper.unmount();
  });

  test('keeps the hovered arc highlighted', async () => {
    const wrapper = mount(SunburstCategories, {
      props: {
        data: {
          name: 'All',
          children: [
            { name: 'Work', children: [{ name: 'Code', size: 3600 }] },
            { name: 'Code', size: 1800 },
          ],
        },
      },
    });
    const arcs = wrapper.findAll('path');
    const hovered = arcs[arcs.length - 1];
    await hovered.trigger('mouseover');

    expect(hovered.attributes('fill-opacity')).toBe('1');
    // Arcs outside the hovered one's ancestry are dimmed
    expect(arcs.some(a => a.attributes('fill-opacity') !== '1')).toBe(true);
    wrapper.unmount();
  });
});
