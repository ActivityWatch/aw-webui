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
        div.mt-2(v-if="dateRange === 'custom'")
          b-form-group(label="Start date" label-size="sm" class="mb-1")
            b-form-input(v-model="customStart" type="date")
          b-form-group(label="End date" label-size="sm" class="mb-0")
            b-form-input(v-model="customEnd" type="date")

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

import 'vue-awesome/icons/sync';
import 'vue-awesome/icons/download';

interface DailyData {
  date: string;
  duration: number;
  sessions: number;
  avgSession: number;
  events: any[];
}

export default {
  name: 'WorkReport',
  data() {
    return {
      categoryStore: useCategoryStore(),
      settingsStore: useSettingsStore(),
      bucketsStore: useBucketsStore(),

      selectedHosts: [], // Will be populated on mount
      selectedCategories: [JSON.stringify(['Work'])], // Default to 'Work' category
      breakTime: 5,
      dateRange: 'last7d',
      customStart: moment().subtract(7, 'days').format('YYYY-MM-DD'),
      customEnd: moment().format('YYYY-MM-DD'),

      loading: false,
      dailyData: [] as DailyData[],
      rawData: {},
    };
  },
  computed: {
    hostOptions() {
      // Get available hosts from window watcher buckets
      const allBuckets = this.bucketsStore.buckets || [];
      const windowBuckets = allBuckets.filter(b => b.type === 'currentwindow');

      const hosts = windowBuckets.map(b => {
        // Extract hostname from bucket ID (format: aw-watcher-window_hostname)
        return b.id.replace('aw-watcher-window_', '');
      });

      return hosts.map(host => ({
        value: host,
        text: host,
      }));
    },

    categoryOptions() {
      // Get all categories (not just those with rules) for the filter
      const cats = this.categoryStore.all_categories || [];
      return cats.map(cat => ({
        value: JSON.stringify(cat), // Store as JSON string to preserve array structure
        text: cat.join(' > '),
      }));
    },
    dateRangeOptions() {
      return [
        { value: 'last7d', text: 'Last 7 days' },
        { value: 'last30d', text: 'Last 30 days' },
        { value: 'thisWeek', text: 'This week' },
        { value: 'thisMonth', text: 'This month' },
        { value: 'custom', text: 'Custom range' },
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

    // Auto-select all available hosts
    if (this.hostOptions.length > 0) {
      this.selectedHosts = this.hostOptions.map(opt => opt.value);
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

        // Get date range
        const timeperiods = this.getTimeperiods();
        if (timeperiods.length === 0) {
          alert('No valid date range selected. Please check your custom date range.');
          this.loading = false;
          return;
        }

        // Build query with flooding
        const breakTimeSeconds = this.breakTime * 60;
        // Parse categories back from JSON strings
        const categoriesFilter = this.selectedCategories.map(c => JSON.parse(c));

        // Get categories for query
        const categories = this.categoryStore.classes_for_query;
        const categoriesStr = JSON.stringify(categories).replace(/\\\\/g, '\\');

        // Build multi-device query with custom flooding
        let query = '';

        // Query each host with custom flooding
        for (const hostname of this.selectedHosts) {
          const safeHost = hostname.replace(/[^a-zA-Z0-9_]/g, '');
          query += `
            events_${safeHost} = flood(query_bucket(find_bucket("aw-watcher-window_${hostname}")), ${breakTimeSeconds});
            events_${safeHost} = categorize(events_${safeHost}, ${categoriesStr});
            events_${safeHost} = filter_keyvals(events_${safeHost}, "$category", ${JSON.stringify(
            categoriesFilter
          )});
          `;
        }

        // Combine events from all hosts using union_no_overlap
        query += '\nevents = [];';
        for (const hostname of this.selectedHosts) {
          const safeHost = hostname.replace(/[^a-zA-Z0-9_]/g, '');
          query += `\nevents = union_no_overlap(events, events_${safeHost});`;
        }

        query += `
          duration = sum_durations(events);
          RETURN = {"events": events, "duration": duration};
        `;

        // Query for each day
        const results = await client.query(timeperiods, [query]);

        // Process results into daily data
        this.dailyData = timeperiods.map((tp, i) => {
          const result = results[i];
          const events = result.events || [];
          const duration = result.duration || 0;

          // tp is a string like "2025-01-01T00:00:00Z/2025-01-02T00:00:00Z"
          const startDate = tp.split('/')[0];

          return {
            date: moment(startDate).format('YYYY-MM-DD'),
            duration,
            sessions: events.length,
            avgSession: events.length > 0 ? duration / events.length : 0,
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
      // Parse the startOfDay offset (format: "HH:MM") into hours and minutes
      const offsetStr = this.settingsStore.startOfDay as string;
      const [offsetHours, offsetMinutes] = offsetStr.split(':').map(Number);

      const addOffset = (m: moment.Moment) =>
        m.add(offsetHours, 'hours').add(offsetMinutes, 'minutes');

      const timeperiods: string[] = [];

      const buildDayRange = (startDay: moment.Moment) => {
        const start = addOffset(startDay.clone().startOf('day'));
        const end = start.clone().add(1, 'day');
        return start.format() + '/' + end.format();
      };

      if (this.dateRange === 'last7d') {
        for (let i = 6; i >= 0; i--) {
          timeperiods.push(buildDayRange(moment().subtract(i, 'days')));
        }
      } else if (this.dateRange === 'last30d') {
        for (let i = 29; i >= 0; i--) {
          timeperiods.push(buildDayRange(moment().subtract(i, 'days')));
        }
      } else if (this.dateRange === 'thisWeek') {
        const current = moment().startOf('isoWeek');
        const today = moment();
        while (current.isSameOrBefore(today, 'day')) {
          timeperiods.push(buildDayRange(current.clone()));
          current.add(1, 'day');
        }
      } else if (this.dateRange === 'thisMonth') {
        const current = moment().startOf('month');
        const today = moment();
        while (current.isSameOrBefore(today, 'day')) {
          timeperiods.push(buildDayRange(current.clone()));
          current.add(1, 'day');
        }
      } else if (this.dateRange === 'custom') {
        if (!this.customStart || !this.customEnd) {
          return [];
        }
        const current = moment(this.customStart);
        const endDay = moment(this.customEnd);
        while (current.isSameOrBefore(endDay, 'day')) {
          timeperiods.push(buildDayRange(current.clone()));
          current.add(1, 'day');
        }
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
          categories: this.selectedCategories.map(c => JSON.parse(c)),
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
