import { shallowMount } from '@vue/test-utils';
import TimelineBarChart from '~/visualizations/TimelineBarChart.vue';

// Exercise the component's computed data, not the canvas renderer's ESM entrypoint.
jest.mock('vue-chartjs/legacy', () => ({ Bar: { render: h => h('div') } }));
jest.mock('chart.js/auto', () => ({}));

const HOUR = 3600000;

describe('exact interval stack bounds', () => {
  test.each([
    [HOUR, [0.75], [0.5]],
    [HOUR / 2, [0.4], [0.25]],
    [HOUR * 1.5, [0.75, 0.4], [0.5, 0.25]],
  ])('clamps overlapping stacks to each bucket in a %p ms interval', (span, values, expected) => {
    const datasets = [
      { label: 'a', data: [...values] },
      { label: 'b', data: [...values] },
    ];
    const wrapper = shallowMount(TimelineBarChart, {
      propsData: {
        datasets,
        timeperiod_start: '2026-10-20T13:00:00Z',
        timeperiod_length: [span, 'milliseconds'],
        clamp_hourly: true,
      },
    });
    const vm: any = wrapper.vm;
    for (const dataset of vm.chartData.datasets) {
      dataset.data.forEach((value: number, i: number) => {
        expect(value).toBeCloseTo(expected[i]);
      });
    }
    expect(datasets[0].data).toEqual(values);
    wrapper.destroy();
  });

  test.each([
    [2 * 86400000, 'milliseconds', true],
    [HOUR, 'milliseconds', false],
    [1, 'day', false],
  ])('does not clamp non-hourly or non-opted-in data (%p, %p, %p)', (count, unit, clamp) => {
    const wrapper = shallowMount(TimelineBarChart, {
      propsData: {
        datasets: [{ label: 'a', data: [2] }],
        timeperiod_start: '2026-10-20T13:00:00Z',
        timeperiod_length: [count, unit],
        clamp_hourly: clamp,
      },
    });
    expect((wrapper.vm as any).chartData.datasets[0].data).toEqual([2]);
    wrapper.destroy();
  });
});

describe('tooltip label', () => {
  const label = (dataset: { label?: string }, y: number) => {
    const wrapper = shallowMount(TimelineBarChart, {
      propsData: {
        datasets: [{ label: 'a', data: [1] }],
        timeperiod_start: '2026-10-20T00:00:00Z',
        timeperiod_length: [1, 'day'],
      },
    });
    const callback = (wrapper.vm as any).chartOptions.plugins.tooltip.callbacks.label;
    wrapper.destroy();
    return callback({ dataset, parsed: { y } });
  };

  test('names the hovered category alongside its duration', () => {
    expect(label({ label: 'Work > Programming' }, 1.5)).toBe('Work > Programming: 1:30');
  });

  test('rounds 59.5+ minutes up to the next hour', () => {
    expect(label({ label: 'Media' }, 0.9999)).toBe('Media: 1:00');
  });

  test('falls back to the duration alone for an unlabeled dataset', () => {
    expect(label({}, 0.25)).toBe('0:15');
  });
});
