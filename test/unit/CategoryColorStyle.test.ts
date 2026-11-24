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

function colorDot(color: string): HTMLElement {
  const wrapper = shallowMount(CategoryEditTree, {
    localVue,
    pinia: createTestingPinia({ createSpy: jest.fn }),
    propsData: {
      _class: {
        id: 0,
        name: ['Work'],
        rule: { type: 'none' },
        data: { color },
        children: [],
      },
    },
    mocks: { $t: (key: string) => key },
    stubs: { icon: true },
  });
  // The color dot is the only `.ml-1` circle; the row's other circle is the
  // tree bullet, which would satisfy a check over all icons on its own.
  const dots = wrapper.findAll('icon-stub.ml-1[name="circle"]');
  expect(dots.length).toBe(1);
  return dots.at(0).element as HTMLElement;
}

test('CategoryEditTree does not apply declarations smuggled in a color', () => {
  const dot = colorDot(injected);
  expect(dot.style.position).toBe('');
  expect(dot.style.inset).toBe('');
  expect(dot.style.zIndex).toBe('');
});

test('CategoryEditTree color dot still shows a valid color', () => {
  const dot = colorDot('#123abc');
  expect(dot.style.color).toBe('rgb(18, 58, 188)');
  expect(dot.style.position).toBe('');
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
