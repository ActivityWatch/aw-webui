<template lang="pug">
div(v-if="datasets && datasets.length > 0")
  bar(:chart-data="chartData" :chart-options="chartOptions")
div.small(v-else-if="datasets === null", style="font-size: 16pt; color: #aaa;")
  | No data
div.small(v-else, style="font-size: 16pt; color: #aaa;")
  | Loading...
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
    resolution: {
      type: String,
      default: 'day',
    },
  },
  computed: {
    labels() {
      const hourOffset = get_hour_offset();
      if (this.resolution === 'day') {
        return _.range(0, 24).map(h => `${(h + hourOffset) % 24}`);
      } else if (this.resolution == 'week') {
        // FIXME: In the future this will depend on a 'start of week' setting
        return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      } else if (this.resolution == 'month') {
        // FIXME: Needs access to the timeperiod start to know which month
        const daysInMonth = 31;
        return ['1st', '2nd', '3rd'].concat(_.range(4, daysInMonth + 1).map(d => `${d}th`));
      } else if (this.resolution == 'year') {
        return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      } else {
        console.error('Invalid resolution');
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
