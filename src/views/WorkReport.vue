<template lang="pug">
div
  h3.mb-3 {{ $t('workReport.title') }}

  div.row.mb-4
    div.col-md-3
      b-form-group(:label="$t('ui.workReport.hosts')" label-class="font-weight-bold")
        b-form-select(v-model="selectedHosts" :options="hostOptions" multiple :select-size="4")
        small.text-muted {{ $t('ui.workReport.selectDevices') }}

    div.col-md-3
      b-form-group(:label="$t('ui.workReport.categories')" label-class="font-weight-bold")
        b-form-select(
          :value="''"
          :options="addableCategoryOptions"
          size="sm"
          @change="addCategory"
        )
        div.mt-2(v-if="selectedCategories.length > 0")
          span.badge.badge-info.mr-1.mb-1(v-for="(cat, idx) in selectedCategories" :key="idx")
            | {{ JSON.parse(cat).join(' > ') }}
            button.ml-1.close.small(
              type="button"
              :aria-label="$t('ui.workReport.removeCategory')"
              style="font-size: 0.85rem; line-height: 1"
              @click="removeCategory(idx)"
            ) &times;
        small.text-muted.d-block.mt-1 {{ $t('ui.workReport.subcategories') }}

    div.col-md-3
      b-form-group(:label="$t('ui.workReport.breakTime')" label-class="font-weight-bold")
        div.d-flex.align-items-center
          b-form-input(
            v-model="breakTime"
            type="range"
            min="0"
            max="30"
            step="1"
          )
          span.ml-2.text-nowrap {{ breakTime }} min
        small.text-muted {{ $t('ui.workReport.breakHelp') }}

    div.col-md-3
      b-form-group(:label="$t('ui.workReport.dateRange')" label-class="font-weight-bold")
        b-form-select(v-model="dateRange" :options="dateRangeOptions")

  div.mb-3.report-actions
    b-button(@click="loadData" variant="primary")
      icon(name="sync")
      |  {{ $t('ui.workReport.calculate') }}
    b-button.ml-2(@click="exportCSV" variant="outline-secondary" :disabled="!hasData")
      icon(name="download")
      |  {{ $t('ui.workReport.exportCsv') }}
    b-button.ml-2(@click="exportJSON" variant="outline-secondary" :disabled="!hasData")
      icon(name="download")
      |  {{ $t('ui.workReport.exportJson') }}

  div(v-if="loading")
    b-spinner.mr-2
    | {{ $t('common.loading') }}

  div(v-if="hasData && !loading")
    h5.mt-4 {{ $t('ui.workReport.dailyBreakdown') }}

    table.table.table-sm.table-hover
      thead
        tr
          th {{ $t('ui.workReport.date') }}
          th.text-right {{ $t('ui.workReport.workTime') }}
          th.text-right {{ $t('ui.workReport.sessions') }}
          th.text-right {{ $t('ui.workReport.avgSession') }}
      tbody
        tr(v-for="day in dailyData" :key="day.date")
          td.text-nowrap {{ day.date }}
          td.text-right {{ formatDuration(day.duration) }}
          td.text-right {{ day.sessions }}
          td.text-right {{ formatDuration(day.avgSession) }}
      tfoot
        tr.font-weight-bold
          td {{ $t('ui.workReport.total') }}
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
  getWorkReportHostBuckets,
  getWorkReportHostOptions,
  getUnsupportedWorkReportHosts,
  buildWorkReportQuery,
  summarizeWorkSessions,
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
      return getWorkReportHostOptions(
        this.bucketsStore.buckets || [],
        this.$t('common.requiresAfk') as string
      );
    },

    categoryOptions() {
      const cats = this.categoryStore.all_categories || [];
      return cats.map(cat => ({
        value: JSON.stringify(cat),
        text: cat.join(' > '),
      }));
    },
    // Hide categories that are already selected (or that are descendants of
    // a selected category, since we auto-include subcategories anyway).
    addableCategoryOptions() {
      const selected: string[][] = this.selectedCategories.map(c => JSON.parse(c));
      const isCoveredBySelected = (cat: string[]) =>
        selected.some(sel => sel.every((seg, i) => cat[i] === seg));
      return [
        {
          value: '',
          text:
            this.selectedCategories.length === 0
              ? this.$t('ui.workReport.selectCategory')
              : this.$t('ui.workReport.addCategory'),
          disabled: true,
        },
        ...this.categoryOptions.filter(opt => !isCoveredBySelected(JSON.parse(opt.value))),
      ];
    },
    dateRangeOptions() {
      return [
        { value: 'last7d', text: this.$t('common.last7d') },
        { value: 'last30d', text: this.$t('common.last30d') },
        { value: 'thisWeek', text: this.$t('common.thisWeek') },
        { value: 'thisMonth', text: this.$t('common.thisMonth') },
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
          alert(this.$t('common.selectHost'));
          this.loading = false;
          return;
        }

        if (this.selectedCategories.length === 0) {
          alert(this.$t('ui.workReport.selectCategory'));
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
              this.$t('ui.workReport.unsupportedHosts', {
                hosts: unsupportedHosts.join(', '),
              })
            );
            this.loading = false;
            return;
          }

          alert(
            this.$t('ui.workReport.skippingHosts', {
              unsupported: unsupportedHosts.join(', '),
              supported: supportedHosts.join(', '),
            })
          );
          this.selectedHosts = supportedHosts;
        }

        const hostsToQuery = getWorkReportHostBuckets(
          this.selectedHosts,
          this.bucketsStore.buckets || []
        );
        const timeperiods = this.getTimeperiods();
        const breakTimeSeconds = this.breakTime * 60;
        // Auto-expand the selection to include subcategories. Selecting
        // "Work" should also match "Work > Programming", "Work > Email",
        // etc., which is what users intuitively expect — aw-query's
        // filter_keyvals only does exact-array matches on $category.
        const allCategories = (this.categoryStore.all_categories || []) as string[][];
        const selected: string[][] = this.selectedCategories.map(c => JSON.parse(c));
        const isDescendant = (sel: string[], cat: string[]) =>
          cat.length >= sel.length && sel.every((seg, i) => cat[i] === seg);
        const expanded: string[][] = [];
        const seen = new Set<string>();
        for (const cat of allCategories) {
          if (selected.some(sel => isDescendant(sel, cat))) {
            const key = JSON.stringify(cat);
            if (!seen.has(key)) {
              seen.add(key);
              expanded.push(cat);
            }
          }
        }
        // Also keep the originally-selected categories even if they aren't
        // in all_categories (defensive).
        for (const sel of selected) {
          const key = JSON.stringify(sel);
          if (!seen.has(key)) {
            seen.add(key);
            expanded.push(sel);
          }
        }
        const categoriesFilter = expanded;

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
          const { bridgedSeconds, sessions } = summarizeWorkSessions(events, breakTimeSeconds);
          const bridged = baseDuration + bridgedSeconds;

          const startDate = tp.split('/')[0];

          return {
            date: moment(startDate).format('YYYY-MM-DD'),
            duration: bridged,
            sessions,
            avgSession: sessions > 0 ? bridged / sessions : 0,
            events,
          };
        });

        this.rawData = results;
      } catch (error) {
        console.error('Error loading work time data:', error);
        alert(this.$t('ui.workReport.loadError'));
      } finally {
        this.loading = false;
      }
    },

    addCategory(value: string) {
      if (!value) return;
      if (!this.selectedCategories.includes(value)) {
        this.selectedCategories = [...this.selectedCategories, value];
      }
    },

    removeCategory(idx: number) {
      this.selectedCategories = this.selectedCategories.filter((_c, i) => i !== idx);
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

/* Use a gap rather than per-button margins so wrapped buttons line up on narrow screens. */
.report-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
