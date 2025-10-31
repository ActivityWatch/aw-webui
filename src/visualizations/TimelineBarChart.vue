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
      const [count, resolution] = this.timeperiod_length;
      
      // Handle custom hour ranges (including fractional hours like 1.5)
      if (resolution.startsWith('hour')) {
        // For custom hour ranges, show start time and end time
        const startDate = new Date(start);
        const startHour = startDate.getHours();
        const startMin = startDate.getMinutes();
        
        // Calculate end time
        const endDate = new Date(startDate.getTime() + count * 60 * 60 * 1000);
        const endHour = endDate.getHours();
        const endMin = endDate.getMinutes();
        
        const formatTime = (h, m) => `${h}:${m.toString().padStart(2, '0')}`;
        
        // Return a single label showing the time range
        return [`${formatTime(startHour, startMin)} - ${formatTime(endHour, endMin)}`];
      } else if (resolution.startsWith('day') && count == 1) {
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
      const resolution = this.timeperiod_length[1];
      const count = this.timeperiod_length[0];
      
      // For custom hour ranges, set appropriate y-axis max
      let suggestedMax = undefined;
      let stepSize = 1;
      
      if (resolution.startsWith('hour')) {
        // For hour ranges, max should be the duration
        suggestedMax = count;
        // Use smaller step size for fractional hours
        stepSize = count < 2 ? 0.25 : 0.5;
      } else if (resolution.startsWith('day')) {
        suggestedMax = 1;
        stepSize = 0.25;
      }
      
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
            suggestedMax: suggestedMax,
            ticks: {
              callback: hourToTick,
              stepSize: stepSize,
            },
          },
        },
      };
    },
  },
};
</script>

<style></style>