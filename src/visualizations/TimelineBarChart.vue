<template lang="pug">
div(v-if="datasets && datasets.length > 0")
  // Height set here to avoid elements jumping when loading Activity view
  bar(:chart-data="chartData" :chart-options="chartOptions" :height="330")
div.small(v-else-if="datasets === null", style="font-size: 16pt; color: #aaa;")
  | No data
div.small(v-else, style="font-size: 16pt; color: #aaa;")
  .aw-loading Loading...
</template>

<script lang="ts">
import _ from 'lodash';
import { ChartOptions } from 'chart.js';
import 'chart.js/auto';
import { Bar } from 'vue-chartjs/legacy';
import { get_hour_offset } from '~/util/time';

function hourToTick(hours: number): string {
  if (hours > 1) {
    return `${hours}h`;
  } else {
    if (hours == 1) {
      return '1h';
    } else if (hours == 0) {
      return '0';
    } else {
      return Math.round(hours * 60) + 'm';
    }
  }
}

export default {
  name: 'TimelineBarChart',
  components: { Bar },
  props: {
    datasets: {
      type: Array,
      default: () => [
        {
          label: 'Total time',
          backgroundColor: '#6699ff',
          data: Array.from({ length: 40 }, () => Math.floor(Math.random() * 40)),
        },
      ],
    },
    timeperiod_start: {
      type: String,
      default: () => null,
    },
    timeperiod_length: {
      type: Array,
      default: () => [1, 'day'],
    },
  },
  computed: {
    labels() {
      const start = this.timeperiod_start;
      const count = this.timeperiod_length[0];
      const resolution = this.timeperiod_length[1];
      if (resolution.startsWith('day') && count == 1) {
        const hourOffset = get_hour_offset();
        return _.range(0, 24).map(h => `${(h + hourOffset) % 24}`);
      } else if (resolution.startsWith('day')) {
        return _.range(count).map(d => `${d + 1}`);
      } else if (resolution.startsWith('week')) {
        // Look up days of the week from `start`
        return _.range(7).map(d => {
          const date = new Date(start);
          date.setDate(date.getDate() + d);
          return date.toLocaleDateString('en-US', { weekday: 'short' });
        });
      } else if (resolution.startsWith('month')) {
        // FIXME: Needs access to the timeperiod start to know which month
        // How many days are in the given month?
        const date = new Date(start);
        const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        return ['1st', '2nd', '3rd'].concat(_.range(4, daysInMonth + 1).map(d => `${d}th`));
      } else if (resolution == 'year') {
        return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      } else {
        console.error(`Invalid resolution: ${resolution}`);
        return [];
      }
    },
    chartData() {
      return {
        labels: this.labels,
        datasets: _.sortBy(this.datasets, d => d.label),
        title: {
          display: true,
          text: 'Timeline',
        },
        responsive: true,
        maintainAspectRatio: false,
      };
    },
    chartOptions(): ChartOptions {
      return {
        plugins: {
          tooltip: {
            mode: 'point',
            intersect: false,
          },
          legend: {
            display: false,
          },
        },
        scales: {
          x: {
            stacked: true,
          },
          y: {
            stacked: true,
            min: 0,
            suggestedMax: this.resolution === 'day' ? 1 : undefined,
            ticks: {
              callback: hourToTick,
              stepSize: this.resolution === 'day' ? 0.25 : 1,
            },
          },
        },
      };
    },
  },
};
</script>

<style></style>
