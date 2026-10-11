<template lang="pug">
div(v-if="datasets && datasets.length > 0")
  // Height set here to avoid elements jumping when loading Activity view
  bar(:chart-data="chartData" :chart-options="chartOptions" :height="height")
div.small(v-else-if="datasets === null", style="font-size: 16pt; color: #aaa;")
  | {{ $t('visualizations.noData') }}
div.small(v-else, style="font-size: 16pt; color: #aaa;")
  .aw-loading {{ $t('common.loading') }}
</template>

<script lang="ts">
import _ from 'lodash';
import { ChartOptions } from 'chart.js';
import 'chart.js/auto';
import { Bar } from 'vue-chartjs/legacy';
import {
  format_date_short,
  format_weekday_short,
  get_hour_offset,
  get_short_month_labels,
} from '~/util/time';
import { MAX_DAILY_BUCKETS, timeperiodsCalendarMonthsOfPeriod } from '~/util/timeperiod';
import { i18n } from '~/i18n';
import { clampStackedHours } from '~/util/timelineClamp';

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
    // Only the single-day hourly activity view should trim overlapping stacks.
    // Other callers (Trends, Report, multi-day Activity) reuse the default
    // `[1, 'day']` timeperiod but pass per-day values, which must not be clamped.
    clamp_hourly: {
      type: Boolean,
      default: false,
    },
    height: {
      type: Number,
      default: 330,
    },
  },
  computed: {
    labels() {
      const start = this.timeperiod_start;
      const [count, resolution] = this.timeperiod_length;
      if (resolution.startsWith('day') && count == 1) {
        const hourOffset = get_hour_offset();
        return _.range(0, 24).map(h => `${(h + hourOffset) % 24}`);
      } else if (resolution.startsWith('day') && count > MAX_DAILY_BUCKETS) {
        // Long custom ranges are bucketed by calendar month (see timeperiodsForBarchart)
        const fmt = new Intl.DateTimeFormat(i18n.locale, { month: 'short', year: 'numeric' });
        return timeperiodsCalendarMonthsOfPeriod({
          start,
          length: [count, resolution],
        }).map(p => fmt.format(new Date(p.start)));
      } else if (resolution.startsWith('day')) {
        return _.range(count).map(d => {
          const date = new Date(start);
          date.setHours(12, 0, 0, 0);
          date.setDate(date.getDate() + d);
          return format_date_short(date, i18n.locale);
        });
      } else if (resolution.startsWith('week')) {
        // Look up days of the week from `start`
        return _.range(7).map(d => {
          const date = new Date(start);
          date.setHours(12, 0, 0, 0);
          date.setDate(date.getDate() + d);
          return format_weekday_short(date);
        });
      } else if (resolution.startsWith('month')) {
        // How many days are in the given month?
        const date = new Date(start);
        const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        return _.range(1, daysInMonth + 1).map(d =>
          format_date_short(new Date(date.getFullYear(), date.getMonth(), d, 12))
        );
      } else if (resolution == 'year') {
        return get_short_month_labels();
      } else {
        console.error(`Invalid resolution: ${resolution}`);
        return [];
      }
    },
    chartData() {
      let datasets = _.sortBy(
        this.datasets.map(d => ({
          ...d,
          label: d.label === 'Total time' ? this.$t('ui.timeline.totalTime') : d.label,
        })),
        d => d.label
      );
      const [count, resolution] = this.timeperiod_length;
      if (this.clamp_hourly && resolution.startsWith('day') && count == 1) {
        datasets = clampStackedHours(datasets);
      }
      return {
        labels: this.labels,
        datasets,
        title: {
          display: true,
          text: this.$t('timeline.title'),
        },
      };
    },
    chartOptions(): ChartOptions {
      const [count, resolution] = this.timeperiod_length;
      const singleDay = resolution.startsWith('day') && count === 1;
      return {
        responsive: true,
        maintainAspectRatio: false,
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
            suggestedMax: singleDay ? 1 : undefined,
            ticks: {
              callback: hourToTick,
              stepSize: singleDay ? 0.25 : undefined,
            },
          },
        },
      };
    },
  },
};
</script>

<style></style>
