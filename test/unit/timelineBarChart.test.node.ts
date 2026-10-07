jest.mock('vue-chartjs/legacy', () => ({ Bar: {} }));
import TimelineBarChart from '~/visualizations/TimelineBarChart.vue';

// Inspect computed Chart.js configuration without mounting a canvas in Node.
const computed = (TimelineBarChart as any).computed;

function chartOptions(count: number, resolution = 'days') {
  return computed.chartOptions.call({ timeperiod_length: [count, resolution] });
}

describe('TimelineBarChart options', () => {
  test('puts responsive height controls in options, not chart data', () => {
    const options = chartOptions(7);
    expect(options.responsive).toBe(true);
    expect(options.maintainAspectRatio).toBe(false);
    const data = computed.chartData.call({
      datasets: [],
      labels: [],
      timeperiod_length: [7, 'days'],
      clamp_hourly: false,
    });
    expect(data).not.toHaveProperty('responsive');
    expect(data).not.toHaveProperty('maintainAspectRatio');
  });

  test('reserves one-hour scale and minute ticks for the single-day chart', () => {
    expect(chartOptions(1).scales.y.suggestedMax).toBe(1);
    expect(chartOptions(1).scales.y.ticks.stepSize).toBe(0.25);
    for (const days of [7, 30, 90, 365]) {
      expect(chartOptions(days).scales.y.suggestedMax).toBeUndefined();
      expect(chartOptions(days).scales.y.ticks.stepSize).toBeUndefined();
    }
  });
});
