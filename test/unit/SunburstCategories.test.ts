import { mount } from '@vue/test-utils';
import { i18n } from '~/i18n';
import { createPinia, setActivePinia } from 'pinia';
import SunburstCategoriesComponent from '~/visualizations/SunburstCategories.vue';
import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';
import { DARK_THEME_HREF } from '~/util/theme';

// Tests call Options API members directly, which the Vue constructor type doesn't expose.
const SunburstCategories: any = SunburstCategoriesComponent;

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

  test('truncates labels that would overflow their ring instead of clipping them', async () => {
    const longName = 'ActivityWatch Development';
    const wrapper = mount(SunburstCategories, {
      attachTo: document.body,
      propsData: {
        data: {
          name: 'All',
          children: [{ name: 'Work', children: [{ name: longName, size: 3600 }] }],
        },
      },
    });

    await wrapper.vm.$nextTick();

    // jsdom has no layout, so the ring itself is 0px wide: only a leaf, which
    // may overflow past its ring, gets a (truncated) label. The parent would be
    // covered by its child ring, so it gets no overflow allowance and no label.
    const labels = wrapper.findAll('text.node-info').wrappers.map(w => w.text());
    expect(labels).not.toContain('Work');
    const truncated = labels.find(l => l.endsWith('…'));
    expect(truncated).toBeDefined();
    expect(longName.startsWith(truncated.slice(0, -1))).toBe(true);

    wrapper.destroy();
  });
  describe('translated default category names', () => {
    beforeEach(() => {
      i18n.locale = 'de';
    });
    afterEach(() => {
      i18n.locale = 'en';
    });

    test('arc labels show the translated name', async () => {
      const wrapper = mount(SunburstCategories, {
        attachTo: document.body,
        propsData: {
          data: { name: 'All', children: [{ name: 'Games', size: 3600 }] },
        },
      });
      await wrapper.vm.$nextTick();

      // The leaf may be truncated in jsdom, but what remains is German text.
      const labels = wrapper.findAll('text.node-info').wrappers.map(w => w.text());
      const label = labels.find(l => l.length > 0);
      expect(label).toBeDefined();
      expect(label.startsWith('Spi')).toBe(true);
      expect('Spiele'.startsWith(label.replace(/…$/, ''))).toBe(true);

      wrapper.destroy();
    });

    test('hover info shows the translated parent path and name', async () => {
      const wrapper = mount(SunburstCategories, {
        attachTo: document.body,
        propsData: {
          data: {
            name: 'All',
            children: [
              {
                name: 'Work',
                children: [{ name: 'Programming', parent: ['Work'], size: 3600 }],
              },
            ],
          },
        },
      });
      await wrapper.vm.$nextTick();

      // Hover through the library's own handler with the d3 node it would pass.
      const leaf = wrapper
        .findAll('path')
        .wrappers.map(w => (w.element as any).__data__)
        .find(d => d?.data?.name === 'Programming');
      expect(leaf).toBeDefined();
      (wrapper.vm.$refs.sunburst as any).mouseOver({ node: leaf });
      await wrapper.vm.$nextTick();

      expect(wrapper.find('.parent').text()).toBe('Arbeit');
      expect(wrapper.find('.name').text()).toBe('Programmierung');

      wrapper.destroy();
    });

    test('colour lookup keeps the stored names', () => {
      const key = SunburstCategories.methods.categoryForColor({ parent: ['Work'], name: 'Code' });
      expect(key).toBe('Work>Code');
      expect(SunburstCategories.methods.colorfunc(key)).toBe('#669933');
    });
  });
});
