import { createLocalVue, shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { PiniaVuePlugin } from 'pinia';
import CategoryEditTree from '~/components/CategoryEditTree.vue';
import ColorPicker from '~/components/ColorPicker.vue';

// ActivityWatch/aw-webui#1328 item 5: string styles are split on `;`, so an
// imported color could add arbitrary declarations (e.g. a full-page overlay).
const injected = 'red; position: fixed; inset: 0; z-index: 99999';

const localVue = createLocalVue();
localVue.use(PiniaVuePlugin);

test('CategoryEditTree does not apply declarations smuggled in a color', () => {
  const wrapper = shallowMount(CategoryEditTree, {
    localVue,
    pinia: createTestingPinia({ createSpy: jest.fn }),
    propsData: {
      _class: {
        id: 0,
        name: ['Work'],
        rule: { type: 'none' },
        data: { color: injected },
        children: [],
      },
    },
    mocks: { $t: (key: string) => key },
    stubs: { icon: true },
  });
  const styled = wrapper.findAll('icon-stub').wrappers.map(w => w.element as HTMLElement);
  expect(styled.length).toBeGreaterThan(0);
  for (const el of styled) expect(el.style.position).toBe('');
});

test('ColorPicker does not apply declarations smuggled in a color', () => {
  const wrapper = shallowMount(ColorPicker, {
    propsData: { value: injected },
    mocks: { $t: (key: string) => key },
  });
  const swatch = wrapper.find('.current-color').element as HTMLElement;
  expect(swatch.style.position).toBe('');
  expect(swatch.style.zIndex).toBe('');
});
