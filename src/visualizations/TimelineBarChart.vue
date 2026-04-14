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
      
      // Handle hour ranges - show individual hour labels
      if (resolution.startsWith('hour')) {
        const startDate = new Date(start);
        const numHours = Math.ceil(count);
        
        return _.range(numHours).map(h => {
          const hourDate = new Date(startDate.getTime() + h * 60 * 60 * 1000);
          const hours = hourDate.getHours();
          const minutes = hourDate.getMinutes();
          
          // Format as HH:MM if there are minutes, otherwise just HH:00
          if (minutes === 0) {
            return `${hours}:00`;
          } else {
            return `${hours}:${minutes.toString().padStart(2, '0')}`;
          }
        });
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
        const ordinalsEnUS = {
          one: 'st',
          two: 'nd',
          few: 'rd',
          many: 'th',
          zero: 'th',
          other: 'th',
        };
        const toOrdinalSuffix = (num: number, locale = 'en-US', ordinals = ordinalsEnUS) => {
          const pluralRules = new Intl.PluralRules(locale, { type: 'ordinal' });
          return `${num}${ordinals[pluralRules.select(num)]}`;
        };
        return _.range(1, daysInMonth + 1).map(d => toOrdinalSuffix(d));
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
      
      // Set appropriate y-axis max based on resolution
      let suggestedMax = undefined;
      let stepSize = 1;
      
      if (resolution.startsWith('hour')) {
        // For hour ranges, each bar represents 1 hour max
        suggestedMax = 1;
        stepSize = 0.25;  // 15-minute increments
      } else if (resolution.startsWith('day')) {
        suggestedMax = 1;
        stepSize = 0.25;
      }
      
      return {
        plugins: {
          tooltip: {
            mode: 'point',
            intersect: false,
            callbacks: {
              label: function (context) {
                const value = context.parsed.y;
                let hours = Math.floor(value);
                let minutes = Math.round((value - hours) * 60);
                if (minutes == 60) {
                  minutes = 0;
                  hours += 1;
                }
                const minutes_str = minutes.toString().padStart(2, '0');
                return `${hours}:${minutes_str}`;
              },
            },
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