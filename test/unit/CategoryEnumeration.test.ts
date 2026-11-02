import { createLocalVue, shallowMount } from '@vue/test-utils';
import { createPinia, PiniaVuePlugin, setActivePinia } from 'pinia';
import { useCategoryStore } from '~/stores/categories';
import WorkReport from '~/views/WorkReport.vue';
import Trends from '~/views/Trends.vue';

jest.mock('~/util/awclient', () => ({ getClient: jest.fn() }));

const localVue = createLocalVue();
localVue.use(PiniaVuePlugin);
localVue.filter('friendlyduration', value => String(value));
const literal = ['Work>>>>Code'];
const nested = ['Work', 'Code'];

function load(names: string[][]) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useCategoryStore();
  store.load(names.map(name => ({ name, rule: { type: 'none' as const } })));
  return { pinia, store };
}

const keys = (paths: string[][]) => paths.map(path => JSON.stringify(path)).sort();

// Each consumer gets its real category store. Suppress only automatic mount-time
// settings/network loading: these tests exercise choices and descendant filters.
function mountConsumer(component, pinia) {
  return shallowMount(
    {
      ...component,
      mounted() {
        /* Network loading is outside this fixture. */
      },
    },
    {
      localVue,
      pinia,
      mocks: { $route: { params: {}, query: {} }, $t: key => key },
      stubs: [
        'b-form-group',
        'b-form-select',
        'b-form-input',
        'b-button',
        'b-button-group',
        'b-alert',
        'b-spinner',
        'b-row',
        'b-col',
        'b-card',
        'b-table',
        'icon',
        'aw-timeline-barchart',
      ],
    }
  );
}

describe('complete category path enumeration', () => {
  test.each([false, true])('retains both delimiter paths (reverse=%s)', reverse => {
    const names = reverse ? [nested, literal] : [literal, nested];
    const { store } = load(names);
    const expected = [literal, ['Work'], nested];
    expect(keys(store.classes.map(category => category.name))).toEqual(keys(expected));
    expect(keys(store.all_categories)).toEqual(keys(expected));
    expect(keys(store.category_select(false).map(option => option.value))).toEqual(keys(expected));
    expect(keys(store.allCategoriesSelect.map(option => option.value))).toEqual(keys(expected));
  });

  test('deduplicates complete arrays and prefixes while retaining first-seen order', () => {
    const { store } = load([]);
    // Direct state also covers duplicate arrays independent of load's cleanup.
    store.classes = [nested, nested, ['Work'], ['Work', 'Mail']].map(name => ({
      name,
      rule: { type: 'none' as const },
    }));
    expect(store.all_categories).toEqual([['Work'], nested, ['Work', 'Mail']]);
  });

  test('empty and Unicode names retain exact segment identity', () => {
    const { store } = load([]);
    expect(store.all_categories).toEqual([]);
    expect(store.category_select(false)).toEqual([]);
    const names = [['å>>>>東京'], ['å', '東京'], ['é'], ['e\u0301'], ['quote"', '\\']];
    store.classes = names.map(name => ({ name, rule: { type: 'none' as const } }));
    expect(keys(store.all_categories)).toEqual(
      keys([['å>>>>東京'], ['å'], ['å', '東京'], ['é'], ['e\u0301'], ['quote"'], ['quote"', '\\']])
    );
  });

  test.each([false, true])('mounted WorkReport offers both paths (reverse=%s)', async reverse => {
    const { pinia } = load(reverse ? [nested, literal] : [literal, nested]);
    const wrapper = mountConsumer(WorkReport, pinia);
    try {
      const vm: any = wrapper.vm;
      await wrapper.setData({ selectedCategories: [] });
      expect(keys(vm.categoryOptions.map(option => JSON.parse(option.value)))).toEqual(
        keys([literal, ['Work'], nested])
      );
      await wrapper.setData({ selectedCategories: [JSON.stringify(['Work'])] });
      expect(vm.addableCategoryOptions.slice(1).map(option => JSON.parse(option.value))).toEqual([
        literal,
      ]);
      await wrapper.setData({ selectedCategories: [JSON.stringify(literal)] });
      expect(
        keys(vm.addableCategoryOptions.slice(1).map(option => JSON.parse(option.value)))
      ).toEqual(keys([['Work'], nested]));
    } finally {
      wrapper.destroy();
    }
  });

  test.each([false, true])(
    'mounted Trends expands structural descendants only (reverse=%s)',
    async reverse => {
      const { pinia } = load(reverse ? [nested, literal] : [literal, nested]);
      const wrapper = mountConsumer(Trends, pinia);
      try {
        const vm: any = wrapper.vm;
        await wrapper.setData({ selectedCategory: ['Work'] });
        expect(vm.filterCategories).toEqual([['Work'], nested]);
        await wrapper.setData({ selectedCategory: literal });
        expect(vm.filterCategories).toEqual([literal]);
        await wrapper.setData({ selectedCategory: null });
        expect(vm.filterCategories).toBeNull();
      } finally {
        wrapper.destroy();
      }
    }
  );
});
