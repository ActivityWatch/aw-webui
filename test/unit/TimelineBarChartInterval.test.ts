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
