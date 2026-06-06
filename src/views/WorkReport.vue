<template lang="pug">
div
  h3.mb-3 Work Time Report

  div.row.mb-4
    div.col-md-3
      b-form-group(label="Hosts" label-class="font-weight-bold")
        b-form-select(v-model="selectedHosts" :options="hostOptions" multiple :select-size="4")
        small.text-muted Select devices to include

    div.col-md-3
      b-form-group(label="Categories" label-class="font-weight-bold")
        b-form-select(v-model="selectedCategories" :options="categoryOptions" multiple :select-size="3")

    div.col-md-3
      b-form-group(label="Break Time" label-class="font-weight-bold")
        div.d-flex.align-items-center
          b-form-input(
            v-model="breakTime"
            type="range"
            min="0"
            max="30"
            step="1"
          )
          span.ml-2.text-nowrap {{ breakTime }} min
        small.text-muted Gaps shorter than this will be counted as work time

    div.col-md-3
      b-form-group(label="Date Range" label-class="font-weight-bold")
        b-form-select(v-model="dateRange" :options="dateRangeOptions")

  div.mb-3
    b-button(@click="loadData" variant="primary")
      icon(name="sync")
      |  Calculate Work Time
    b-button.ml-2(@click="exportCSV" variant="outline-secondary" :disabled="!hasData")
      icon(name="download")
      |  Export CSV
    b-button.ml-2(@click="exportJSON" variant="outline-secondary" :disabled="!hasData")
      icon(name="download")
      |  Export JSON

  div(v-if="loading")
    b-spinner.mr-2
    | Loading...

  div(v-if="hasData && !loading")
    h5.mt-4 Daily Breakdown

    table.table.table-sm.table-hover
      thead
        tr
          th Date
          th.text-right Work Time
          th.text-right Sessions
          th.text-right Avg Session
      tbody
        tr(v-for="day in dailyData" :key="day.date")
          td {{ day.date }}
          td.text-right {{ formatDuration(day.duration) }}
          td.text-right {{ day.sessions }}
          td.text-right {{ formatDuration(day.avgSession) }}
      tfoot
        tr.font-weight-bold
          td Total
          td.text-right {{ formatDuration(totalDuration) }}
          td.text-right {{ totalSessions }}
          td.text-right {{ formatDuration(avgSessionLength) }}

</template>

<script lang="ts">
import moment from 'moment';
import { getClient } from '~/util/awclient';
import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';
import { get_day_start_with_offset, get_day_end_with_offset } from '~/util/time';
import {
  getSupportedWorkReportHosts,
  getWorkReportHostOptions,
  getUnsupportedWorkReportHosts,
  buildWorkReportQuery,
} from '~/util/workReport';

import 'vue-awesome/icons/sync';
import 'vue-awesome/icons/download';

interface DailyData {
  date: string;
  duration: number;
  sessions: number;
  avgSession: number;
  events: any[];
}

// Sum of gaps between adjacent events that are <= breakTimeSeconds.
function bridgeGaps(events: any[], breakTimeSeconds: number): number {
  if (!events || events.length < 2 || breakTimeSeconds <= 0) return 0;
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  let extra = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = new Date(sorted[i - 1].timestamp).getTime() + sorted[i - 1].duration * 1000;
    const gap = (new Date(sorted[i].timestamp).getTime() - prevEnd) / 1000;
    if (gap > 0 && gap <= breakTimeSeconds) extra += gap;
  }
  return extra;
}

export default {
  name: 'WorkReport',
  data() {
    return {
      categoryStore: useCategoryStore(),
      settingsStore: useSettingsStore(),
      bucketsStore: useBucketsStore(),

      selectedHosts: [] as string[],
      selectedCategories: [JSON.stringify(['Work'])],
      breakTime: 5,
      dateRange: 'last7d',

      loading: false,
      dailyData: [] as DailyData[],
      rawData: {} as Record<string, any>,
    };
  },
  computed: {
    hostOptions() {
      return getWorkReportHostOptions(this.bucketsStore.buckets || []);
    },

    categoryOptions() {
      const cats = this.categoryStore.all_categories || [];
      return cats.map(cat => ({
        value: JSON.stringify(cat),
        text: cat.join(' > '),
      }));
    },
    dateRangeOptions() {
      return [
        { value: 'last7d', text: 'Last 7 days' },
        { value: 'last30d', text: 'Last 30 days' },
        { value: 'thisWeek', text: 'This week' },
        { value: 'thisMonth', text: 'This month' },
      ];
    },
    hasData() {
      return this.dailyData.length > 0;
    },
    totalDuration() {
      return this.dailyData.reduce((sum, day) => sum + day.duration, 0);
    },
    totalSessions() {
      return this.dailyData.reduce((sum, day) => sum + day.sessions, 0);
    },
    avgSessionLength() {
      return this.totalSessions > 0 ? this.totalDuration / this.totalSessions : 0;
    },
  },
  async mounted() {
    this.categoryStore.load();
    await this.bucketsStore.ensureLoaded();

    if (this.hostOptions.length > 0) {
      this.selectedHosts = this.hostOptions.filter(opt => !opt.disabled).map(opt => opt.value);
    }
  },
  methods: {
    async loadData() {
      this.loading = true;
      try {
        const client = getClient();

        if (this.selectedHosts.length === 0) {
          alert('Please select at least one host');
          this.loading = false;
          return;
        }

        if (this.selectedCategories.length === 0) {
          alert('Please select at least one category');
          this.loading = false;
          return;
        }

        const unsupportedHosts = getUnsupportedWorkReportHosts(
          this.selectedHosts,
          this.bucketsStore.buckets || []
        );
        if (unsupportedHosts.length > 0) {
          const supportedHosts = getSupportedWorkReportHosts(
            this.selectedHosts,
            this.bucketsStore.buckets || []
          );
          if (supportedHosts.length === 0) {
            alert(
              `The selected hosts are missing aw-watcher-afk buckets and can't be included in Work Report: ${unsupportedHosts.join(
                ', '
              )}`
            );
            this.loading = false;
            return;
          }

          alert(
            `Skipping hosts without aw-watcher-afk buckets: ${unsupportedHosts.join(
              ', '
            )}. Work Report will use: ${supportedHosts.join(', ')}`
          );
          this.selectedHosts = supportedHosts;
        }

        const hostsToQuery = getSupportedWorkReportHosts(
          this.selectedHosts,
          this.bucketsStore.buckets || []
        );
        const timeperiods = this.getTimeperiods();
        const breakTimeSeconds = this.breakTime * 60;
        const categoriesFilter = this.selectedCategories.map(c => JSON.parse(c));

        const categories = this.categoryStore.classes_for_query;
        const categoriesStr = JSON.stringify(categories).replace(/\\\\/g, '\\');

        const query = buildWorkReportQuery(hostsToQuery, categoriesStr, categoriesFilter);

        const results = await client.query(timeperiods, [query]);

        this.dailyData = timeperiods.map((tp, i) => {
          const result = results[i];
          const events = result.events || [];
          const baseDuration = result.duration || 0;
          // Bridge sub-breakTime gaps between adjacent events so a quick
          // context-switch still counts as continuous work time. aw-query's
          // flood() only deduplicates overlap, so we add the bridging here.
          const bridged = baseDuration + bridgeGaps(events, breakTimeSeconds);

          const startDate = tp.split('/')[0];

          return {
            date: moment(startDate).format('YYYY-MM-DD'),
            duration: bridged,
            sessions: events.length,
            avgSession: events.length > 0 ? bridged / events.length : 0,
            events,
          };
        });

        this.rawData = results;
      } catch (error) {
        console.error('Error loading work time data:', error);
        alert('Error loading data. See console for details.');
      } finally {
        this.loading = false;
      }
    },

    getTimeperiods(): string[] {
      const offset = this.settingsStore.startOfDay;
      const timeperiods: string[] = [];

      // Resolve to an inclusive [startDate, today] window. For "thisWeek" and
      // "thisMonth" the start anchors to the calendar boundary (not "N days
      // ago"), so on a Wednesday "thisMonth" gives Mar 1..Mar 5, not Mar 1..N.
      let startDate: moment.Moment;
      const today = moment().startOf('day');

      if (this.dateRange === 'last7d') {
        startDate = today.clone().subtract(6, 'days');
      } else if (this.dateRange === 'last30d') {
        startDate = today.clone().subtract(29, 'days');
      } else if (this.dateRange === 'thisWeek') {
        startDate = moment().startOf('isoWeek');
      } else if (this.dateRange === 'thisMonth') {
        startDate = moment().startOf('month');
      } else {
        startDate = today.clone().subtract(6, 'days');
      }

      const days = today.diff(startDate, 'days') + 1;
      for (let i = days - 1; i >= 0; i--) {
        const date = moment().subtract(i, 'days');
        const start = get_day_start_with_offset(date, offset);
        const end = get_day_end_with_offset(date, offset);
        timeperiods.push(start + '/' + end);
      }

      return timeperiods;
    },

    formatDuration(seconds: number): string {
      if (!seconds) return '0:00';
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    },

    exportCSV() {
      const headers = ['Date', 'Duration (hours)', 'Sessions', 'Avg Session (minutes)'];
      const rows = this.dailyData.map(day => [
        day.date,
        (day.duration / 3600).toFixed(2),
        day.sessions,
        (day.avgSession / 60).toFixed(1),
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
        '',
        `Total,${(this.totalDuration / 3600).toFixed(2)},${this.totalSessions},${(
          this.avgSessionLength / 60
        ).toFixed(1)}`,
      ].join('\n');

      this.downloadFile(csv, 'work_time_report.csv', 'text/csv');
    },

    exportJSON() {
      const data = {
        parameters: {
          categories: this.selectedCategories,
          breakTime: this.breakTime,
          dateRange: this.dateRange,
        },
        summary: {
          totalDuration: this.totalDuration,
          totalSessions: this.totalSessions,
          avgSessionLength: this.avgSessionLength,
        },
        daily: this.dailyData,
        rawEvents: this.rawData,
      };

      const json = JSON.stringify(data, null, 2);
      this.downloadFile(json, 'work_time_report.json', 'application/json');
    },

    downloadFile(content: string, filename: string, mimeType: string) {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
  },
};
</script>

<style scoped>
.table {
  font-size: 0.9rem;
}
</style>
