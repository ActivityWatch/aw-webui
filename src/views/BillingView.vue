<template lang="pug">
div
  h3.mb-3 {{ $t('ui.billing.title') }}

  div.row.mb-4
    div.col-md-4
      b-form-group(:label="$t('ui.billing.hosts')" label-class="font-weight-bold")
        b-form-select(v-model="selectedHosts" :options="hostOptions" multiple :select-size="4")
        small.text-muted {{ $t('ui.billing.selectDevices') }}

    div.col-md-4
      b-form-group(:label="$t('ui.billing.dateRange')" label-class="font-weight-bold")
        b-form-select(v-model="dateRange" :options="dateRangeOptions")

    div.col-md-4
      b-form-group(:label="$t('ui.billing.hourlyRate')" label-class="font-weight-bold")
        b-input-group(prepend="$")
          b-form-input(
            v-model.number="defaultRate"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
          )
        small.text-muted {{ $t('ui.billing.defaultRateHelp') }}

  div.mb-3
    b-button(@click="loadData" variant="primary" :disabled="loading")
      icon(name="sync")
      |  {{ $t('ui.billing.calculate') }}
    b-button.ml-2(@click="exportCSV" variant="outline-secondary" :disabled="!hasData")
      icon(name="download")
      |  {{ $t('ui.billing.exportCsv') }}

  div(v-if="loading")
    b-spinner.mr-2
    | {{ $t('common.loading') }}

  div(v-if="errorMessage")
    b-alert(variant="danger" show) {{ errorMessage }}

  div(v-if="hasData && !loading")
    div.row.mb-2
      div.col
        small.text-muted
          | {{ $t('ui.billing.period') }}: {{ periodLabel }} · {{ $t('ui.billing.total') }}: {{ formatDuration(totalDuration) }}
          span(v-if="defaultRate > 0")  · {{ $t('ui.billing.estimatedTotal') }}: {{ formatAmount(totalAmount) }}

    table.table.table-sm.table-hover
      thead
        tr
          th {{ $t('ui.billing.category') }}
          th.text-right {{ $t('ui.billing.hours') }}
          th.text-right {{ $t('ui.billing.rate') }}
          th.text-right {{ $t('ui.billing.amount') }}
      tbody
        tr(v-for="row in categoryRows" :key="row.key")
          td
            span.badge.mr-1(:style="{ background: '#6c757d', color: 'white' }") {{ row.depth > 0 ? '↳ ' : '' }}
            | {{ row.label }}
          td.text-right {{ formatHours(row.duration) }}
          td.text-right
            b-form-input(
              v-model.number="categoryRates[row.key]"
              type="number"
              min="0"
              step="0.01"
              size="sm"
              style="width: 80px; display: inline-block"
              :placeholder="defaultRate > 0 ? String(defaultRate) : '0.00'"
            )
          td.text-right {{ formatAmount(getAmount(row)) }}
      tfoot
        tr.font-weight-bold
          td {{ $t('ui.billing.total') }}
          td.text-right {{ formatHours(totalDuration) }}
          td.text-right —
          td.text-right {{ formatAmount(totalAmount) }}
</template>

<script lang="ts">
import moment from 'moment';
import { getClient } from '~/util/awclient';
import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';
import { get_day_start_with_offset, get_day_end_with_offset } from '~/util/time';
import {
  getWorkReportHostBuckets,
  getWorkReportHostOptions,
  getUnsupportedWorkReportHosts,
  WorkReportHostBuckets,
} from '~/util/workReport';

import 'vue-awesome/icons/sync';
import 'vue-awesome/icons/download';

interface CategoryRow {
  key: string; // JSON.stringify(parts) — unambiguous identity for rate lookup
  category: string; // parts.join(' > ') — display label in UI and CSV
  label: string;
  depth: number;
  duration: number;
}

function buildBillingQuery(hosts: WorkReportHostBuckets[], categoriesStr: string): string {
  let query = '';
  for (let hi = 0; hi < hosts.length; hi++) {
    const bucketIds = hosts[hi];
    query += `
events_${hi} = flood(query_bucket(${JSON.stringify(bucketIds.window)}));
not_afk_${hi} = flood(query_bucket(${JSON.stringify(bucketIds.afk)}));
not_afk_${hi} = filter_keyvals(not_afk_${hi}, "status", ["not-afk"]);
events_${hi} = filter_period_intersect(events_${hi}, not_afk_${hi});
events_${hi} = categorize(events_${hi}, ${categoriesStr});`;
  }
  query += '\nevents = [];';
  for (let hi = 0; hi < hosts.length; hi++) {
    query += `\nevents = union_no_overlap(events, events_${hi});`;
  }
  query += `
duration = sum_durations(events);
RETURN = {"events": events, "duration": duration};`;
  return query
    .split('\n')
    .map(line => line.replace(/\s+$/, ''))
    .join('\n');
}

export default {
  name: 'BillingView',
  data() {
    return {
      categoryStore: useCategoryStore(),
      settingsStore: useSettingsStore(),
      bucketsStore: useBucketsStore(),

      selectedHosts: [] as string[],
      dateRange: 'thisMonth',
      defaultRate: 0,
      categoryRates: {} as Record<string, number>,

      loading: false,
      errorMessage: '',
      categoryRows: [] as CategoryRow[],
      totalDuration: 0,
      queriedPeriod: '' as string,
    };
  },
  computed: {
    hostOptions() {
      return getWorkReportHostOptions(
        this.bucketsStore.buckets || [],
        this.$t('common.requiresAfk') as string
      );
    },
    dateRangeOptions() {
      return [
        { value: 'thisMonth', text: this.$t('common.thisMonth') },
        { value: 'last30d', text: this.$t('common.last30d') },
        { value: 'thisWeek', text: this.$t('common.thisWeek') },
        { value: 'last7d', text: this.$t('common.last7d') },
      ];
    },
    hasData() {
      return this.categoryRows.length > 0;
    },
    totalAmount() {
      return this.categoryRows.reduce((sum, row) => sum + this.getAmount(row), 0);
    },
    periodLabel() {
      const tp = this.queriedPeriod || this.getTimeperiod();
      const [start, end] = tp.split('/');
      return `${moment(start).format('MMM D')} – ${moment(end).format('MMM D, YYYY')}`;
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
    getTimeperiod(): string {
      const offset = this.settingsStore.startOfDay;
      let startDate: moment.Moment;
      const today = moment();

      if (this.dateRange === 'thisMonth') {
        startDate = moment().startOf('month');
      } else if (this.dateRange === 'last30d') {
        startDate = today.clone().subtract(29, 'days');
      } else if (this.dateRange === 'thisWeek') {
        startDate = moment().startOf('isoWeek');
      } else {
        startDate = today.clone().subtract(6, 'days');
      }

      const start = get_day_start_with_offset(startDate, offset);
      const end = get_day_end_with_offset(today, offset);
      return `${start}/${end}`;
    },

    async loadData() {
      this.loading = true;
      this.errorMessage = '';
      try {
        const client = getClient();

        if (this.selectedHosts.length === 0) {
          this.errorMessage = this.$t('common.selectHost');
          return;
        }

        const unsupported = getUnsupportedWorkReportHosts(
          this.selectedHosts,
          this.bucketsStore.buckets || []
        );
        const hostsToQuery = getWorkReportHostBuckets(
          this.selectedHosts,
          this.bucketsStore.buckets || []
        );
        if (hostsToQuery.length === 0) {
          this.errorMessage = this.$t('ui.billing.noSupportedHosts', {
            hosts: unsupported.join(', '),
          });
          return;
        }

        const categories = this.categoryStore.classes_for_query;
        const categoriesStr = JSON.stringify(categories).replace(/\\\\/g, '\\');
        const query = buildBillingQuery(hostsToQuery, categoriesStr);
        const tp = this.getTimeperiod();

        const [result] = await client.query([tp], [query]);
        // Only update queriedPeriod after a successful query so that on
        // failure the existing rows continue to display with their correct period.
        this.queriedPeriod = tp;
        const events: any[] = result.events || [];
        this.totalDuration = result.duration || 0;

        // Aggregate duration by category path.
        // Key: JSON.stringify(parts) — unambiguous even if a segment contains ' > '.
        const durationMap: Record<string, number> = {};
        for (const event of events) {
          const cat: string[] = event.data?.['$category'] || ['Uncategorized'];
          const key = JSON.stringify(cat);
          durationMap[key] = (durationMap[key] || 0) + event.duration;
        }

        // Build rows sorted by display label.
        this.categoryRows = Object.entries(durationMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, duration]) => {
            const parts: string[] = JSON.parse(key);
            return {
              key,
              category: parts.join(' > '),
              label: parts[parts.length - 1],
              depth: parts.length - 1,
              duration,
            };
          });
      } catch (err: any) {
        this.errorMessage = this.$t('ui.billing.loadError', { error: err?.message || err });
        console.error(err);
      } finally {
        this.loading = false;
      }
    },

    getEffectiveRate(row: CategoryRow): number {
      const explicit = this.categoryRates[row.key];
      // Treat explicitly-entered 0 as "not billable" (don't fall back to defaultRate).
      // Only fall back when the field has never been touched (undefined/null/'').
      if (explicit !== undefined && explicit !== null && explicit !== '') return Number(explicit);
      return this.defaultRate || 0;
    },

    getAmount(row: CategoryRow): number {
      return (row.duration / 3600) * this.getEffectiveRate(row);
    },

    formatHours(seconds: number): string {
      return (seconds / 3600).toFixed(2);
    },

    formatDuration(seconds: number): string {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return `${h}h ${m}m`;
    },

    formatAmount(amount: number): string {
      if (!amount) return '—';
      return `$${amount.toFixed(2)}`;
    },

    exportCSV() {
      const tp = this.queriedPeriod || this.getTimeperiod();
      const [start, end] = tp.split('/');
      const header = [
        `# Billable Hours Export`,
        `# Period: ${moment(start).format('YYYY-MM-DD')} to ${moment(end).format('YYYY-MM-DD')}`,
        `# Generated: ${moment().format('YYYY-MM-DD HH:mm')}`,
        '',
      ].join('\n');

      const cols = ['Category', 'Hours', 'Rate ($/h)', 'Amount ($)'];
      const rows = this.categoryRows.map(row => {
        const rate = this.getEffectiveRate(row);
        const amount = this.getAmount(row);
        return [
          '"' + row.category.replace(/"/g, '""') + '"',
          (row.duration / 3600).toFixed(2),
          rate > 0 ? rate.toFixed(2) : '',
          amount > 0 ? amount.toFixed(2) : '',
        ].join(',');
      });
      const totalRate = '';
      const totalAmountStr = this.totalAmount > 0 ? this.totalAmount.toFixed(2) : '';
      const totalsRow = [
        '"TOTAL"',
        (this.totalDuration / 3600).toFixed(2),
        totalRate,
        totalAmountStr,
      ].join(',');

      const csv = header + [cols.join(','), ...rows, '', totalsRow].join('\n');
      this.downloadFile(csv, `billable-hours-${moment(start).format('YYYY-MM')}.csv`, 'text/csv');
    },

    downloadFile(content: string, filename: string, mimeType: string) {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
