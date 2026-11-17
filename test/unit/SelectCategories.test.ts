import Vue from 'vue';
import { createLocalVue, mount, Wrapper } from '@vue/test-utils';
import { BootstrapVue } from 'bootstrap-vue';
import { createPinia, PiniaVuePlugin, setActivePinia } from 'pinia';
import SelectCategories from '~/components/SelectCategories.vue';
import SelectCategoriesOrPattern from '~/components/SelectCategoriesOrPattern.vue';
import { useCategoryStore } from '~/stores/categories';
import { Category } from '~/util/classes';

const localVue = createLocalVue();
localVue.use(PiniaVuePlugin);
localVue.use(BootstrapVue);
localVue.component('aw-select-categories', SelectCategories);

const fixtures: Category[] = [
  { name: ['Work'], rule: { type: 'regex', regex: 'work' } },
  { name: ['Work', 'Code'], rule: { type: 'regex', regex: 'code' } },
  { name: ['Work', 'Code', 'Editor'], rule: { type: 'regex', regex: 'editor' } },
  { name: ['Leisure', 'Work'], rule: { type: 'regex', regex: 'leisure' } },
  { name: ['Work > Code'], rule: { type: 'regex', regex: 'literal' } },
  { name: ['Homework'], rule: { type: 'regex', regex: 'homework' } },
  { name: ['work'], rule: { type: 'regex', regex: 'lowercase' } },
  { name: ['Work', 'No rule'], rule: { type: 'none' } },
  { name: [' Quotes " > Ω ', 'Trailing > '], rule: { type: 'regex', regex: 'special' } },
];

async function settle() {
  await Vue.nextTick();
  await Vue.nextTick();
}

function latest(wrapper: Wrapper<Vue>) {
  const events = wrapper.emitted('input') || [];
  return events[events.length - 1]?.[0];
}

async function choose(wrapper: Wrapper<Vue>, index: number) {
  // Exercise Bootstrap's real select -> tags change -> v-model pipeline.
  const select = wrapper.find('select');
  (select.element as HTMLSelectElement).selectedIndex = index + 1;
  await select.trigger('change');
  await settle();
}

describe('structural category selectors', () => {
  let wrappers: Wrapper<Vue>[];

  beforeEach(() => {
    setActivePinia(createPinia());
    const store = useCategoryStore();
    store.classes = JSON.parse(JSON.stringify(fixtures));
    jest.spyOn(store, 'load').mockImplementation(() => undefined);
    wrappers = [];
  });

  afterEach(() => {
    wrappers.forEach(wrapper => wrapper.destroy());
    jest.restoreAllMocks();
  });

  function selector(propsData = {}) {
    const wrapper = mount(SelectCategories, { localVue, propsData });
    wrappers.push(wrapper);
    return wrapper;
  }

  function combined(filterCategories: string[][] = []) {
    const wrapper = mount(SelectCategoriesOrPattern, {
      localVue,
      propsData: { filterCategories },
    });
    wrappers.push(wrapper);
    return wrapper;
  }

  test('real tag selection distinguishes identical display labels and removes only one path', async () => {
    const wrapper = selector();
    await choose(wrapper, 1);
    await choose(wrapper, 4);
    expect(latest(wrapper)).toEqual([['Work', 'Code'], ['Work > Code']]);
    const tags = wrapper.findAll('.b-form-tag');
    expect(tags).toHaveLength(2);
    expect(tags.at(0).text()).toContain('Work > Code');
    expect(tags.at(1).text()).toContain('Work > Code');
    expect(tags.at(0).attributes('title')).toBe('Work > Code');
    await tags.at(0).find('button').trigger('click');
    await settle();
    expect(latest(wrapper)).toEqual([['Work > Code']]);
  });

  test('literal delimiter, whitespace, quote and Unicode segments round-trip unchanged', async () => {
    const wrapper = selector();
    await choose(wrapper, 8);
    expect(latest(wrapper)).toEqual([fixtures[8].name]);
    // Wrapper.text() trims whitespace; the title preserves the exact display label.
    expect(wrapper.find('.b-form-tag').attributes('title')).toBe(fixtures[8].name.join(' > '));
    expect(useCategoryStore().classes).toEqual(fixtures);
  });

  test('initial and updated value props drive visible tags without input feedback', async () => {
    const wrapper = selector({ value: [['Work > Code']] });
    await settle();
    expect(wrapper.findAll('.b-form-tag')).toHaveLength(1);
    expect(wrapper.find('.b-form-tag').text()).toContain('Work > Code');
    await wrapper.setProps({ value: [['Work', 'Code'], fixtures[8].name] });
    expect(wrapper.findAll('.b-form-tag')).toHaveLength(2);
    expect(wrapper.emitted('input')).toBeUndefined();
    await wrapper.setProps({ value: [] });
    expect(wrapper.findAll('.b-form-tag')).toHaveLength(0);
  });

  test.each([
    { selected: [['Work']], expected: [0, 1, 2] },
    { selected: [['Work', 'Code']], expected: [1, 2] },
    { selected: [['Work > Code']], expected: [4] },
    { selected: [['work']], expected: [6] },
    { selected: [['Work'], ['Work', 'Code'], ['Work']], expected: [0, 1, 2] },
    { selected: [['Missing']], expected: [] },
    { selected: [], expected: [] },
    { selected: [[]], expected: [] },
  ])('emits only structural regex descendants for $selected', async ({ selected, expected }) => {
    const wrapper = combined();
    await wrapper.setProps({ filterCategories: selected });
    await settle();
    expect(latest(wrapper)).toEqual(expected.map(i => [fixtures[i].name, fixtures[i].rule]));
  });

  test('mounted two-selector wiring filters selected paths, then clears on tag removal', async () => {
    const wrapper = combined();
    const tags = wrapper.findComponent(SelectCategories);
    await choose(tags, 1);
    await choose(tags, 4);
    expect(latest(wrapper)).toEqual([1, 2, 4].map(i => [fixtures[i].name, fixtures[i].rule]));
    await tags.findAll('.b-form-tag').at(0).find('button').trigger('click');
    await settle();
    expect(latest(wrapper)).toEqual([[fixtures[4].name, fixtures[4].rule]]);
    await tags.find('.b-form-tag button').trigger('click');
    await settle();
    expect(latest(wrapper)).toEqual([]);
  });

  test('initial selection, replacement props and asynchronously loaded rules stay synchronized', async () => {
    const wrapper = combined([['Work']]);
    await settle();
    expect(latest(wrapper)).toEqual([0, 1, 2].map(i => [fixtures[i].name, fixtures[i].rule]));
    expect(wrapper.findAll('.b-form-tag')).toHaveLength(1);
    await wrapper.setProps({ filterCategories: [['Work > Code']] });
    await settle();
    expect(latest(wrapper)).toEqual([[fixtures[4].name, fixtures[4].rule]]);
    expect(wrapper.findAll('.b-form-tag')).toHaveLength(1);
    useCategoryStore().classes = [];
    await settle();
    expect(latest(wrapper)).toEqual([]);
    useCategoryStore().classes = JSON.parse(JSON.stringify(fixtures));
    await settle();
    expect(latest(wrapper)).toEqual([[fixtures[4].name, fixtures[4].rule]]);
    await wrapper.setProps({ filterCategories: [] });
    await settle();
    expect(latest(wrapper)).toEqual([]);
    expect(wrapper.findAll('.b-form-tag')).toHaveLength(0);
  });

  test('switching modes emits current custom rules and preserves selected category tags', async () => {
    const wrapper = combined([['Work', 'Code']]);
    await settle();
    const mode = wrapper.find('select');
    await mode.setValue('custom');
    await settle();
    expect(latest(wrapper)).toEqual([[['searched'], { type: 'regex', regex: '' }]]);
    await wrapper.find('input').setValue('editor.*code');
    await settle();
    expect(latest(wrapper)).toEqual([[['searched'], { type: 'regex', regex: 'editor.*code' }]]);
    await mode.setValue('categories');
    await settle();
    expect(latest(wrapper)).toEqual([1, 2].map(i => [fixtures[i].name, fixtures[i].rule]));
    expect(wrapper.findAll('.b-form-tag')).toHaveLength(1);
  });
});
