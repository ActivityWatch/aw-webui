import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Vue from 'vue';
import SelectableEventView from '~/components/SelectableEventView.vue';
import Summary from '~/visualizations/Summary.vue';
import summary from '~/visualizations/summary';

Vue.component('aw-summary', Summary);

const event = {
  duration: 60,
  data: { title: 'TITLE_ONE', app: 'APP_ONE' },
};

function svgName(wrapper: any): string | null {
  const title = wrapper.element.querySelector('g[id^="summary_"] > title');
  return title ? title.textContent.split('\n')[0] : null;
}

function svgFill(wrapper: any): string {
  const rect = wrapper.element.querySelector('g[id^="summary_"] > rect');
  return rect ? rect.getAttribute('style') || '' : '';
}

async function flush(wrapper: any) {
  await wrapper.vm.$nextTick();
  await new Promise(resolve => setTimeout(resolve, 20));
}

describe('SelectableEventView summary key', () => {
  beforeEach(() => setActivePinia(createPinia()));

  test('redraws labels and colors when the data key changes without replacing events', async () => {
    const wrapper = mount(SelectableEventView, {
      propsData: { events: [event] },
      stubs: { 'vis-timeline': true, 'aw-eventlist': true },
      attachTo: document.body,
    });
    try {
      wrapper.setData({ vis_method: 'summary' });
      await flush(wrapper);
      expect(svgName(wrapper)).toBe('TITLE_ONE');
      expect(svgFill(wrapper)).toMatch(/fill:/);

      const input = wrapper.find('input');
      input.element.value = 'title';
      input.trigger('change');
      await flush(wrapper);
      expect(svgName(wrapper)).toBe('TITLE_ONE');

      input.element.value = '  app  ';
      input.trigger('change');
      await flush(wrapper);
      expect(wrapper.vm.summaryKey).toBe('app');
      expect(svgName(wrapper)).toBe('APP_ONE');
    } finally {
      wrapper.destroy();
    }
  });

  test('keeps an equivalent new event array able to redraw after the key is already app', async () => {
    const wrapper = mount(SelectableEventView, {
      propsData: { events: [event] },
      stubs: { 'vis-timeline': true, 'aw-eventlist': true },
      attachTo: document.body,
    });
    try {
      wrapper.setData({ vis_method: 'summary' });
      await flush(wrapper);
      const input = wrapper.find('input');
      input.element.value = 'app';
      input.trigger('change');
      await flush(wrapper);
      wrapper.setProps({
        events: [{ duration: 60, data: { title: 'TITLE_ONE', app: 'APP_ONE' } }],
      });
      await flush(wrapper);
      expect(svgName(wrapper)).toBe('APP_ONE');
    } finally {
      wrapper.destroy();
    }
  });

  test('coalesces simultaneous fields and callback changes onto one redraw', async () => {
    const nameA = e => e.data.title;
    const nameB = e => e.data.app;
    const colorA = e => e.data.title;
    const colorB = e => e.data.app;
    const wrapper = mount(Summary, {
      propsData: {
        fields: [event],
        namefunc: nameA,
        colorfunc: colorA,
      },
      attachTo: document.body,
    });
    try {
      await flush(wrapper);
      const spy = jest.spyOn(summary, 'updateSummedEvents');
      wrapper.setProps({
        fields: [{ duration: 60, data: { title: 'TITLE_ONE', app: 'APP_ONE' } }],
        namefunc: nameB,
        colorfunc: colorB,
      });
      await wrapper.vm.$nextTick();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(svgName(wrapper)).toBe('APP_ONE');
    } finally {
      wrapper.destroy();
    }
  });
});
