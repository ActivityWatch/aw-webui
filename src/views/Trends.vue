<template lang="pug">
div
  div.d-flex.flex-wrap.align-items-center.mb-3
    h3.mb-0.mr-3 Trends

    b-button-group.mr-2.mb-1(size="sm")
      b-button.px-3(
        v-for="opt in periodOptions"
        :key="opt.value"
        :pressed="periodDays === opt.value"
        @click="setPeriod(opt.value)"
        variant="outline-dark"
      ) {{ opt.text }}

    b-form-select.mr-2.mb-1(
      v-if="bucketsStore.hosts.length > 1"
      size="sm"
      :value="host"
      :options="hostOptions"
      @change="onHostChange"
      style="width: auto"
    )

    small.text-muted.ml-auto.mb-1
      | Comparing #[b {{ currentRangeLabel }}] vs #[b {{ previousRangeLabel }}].

  div(v-if="!host")
    b-alert(show variant="info")
      | No host with window/AFK buckets available. Install
      | #[a(href="https://docs.activitywatch.net/en/latest/watchers.html") aw-watcher-window and aw-watcher-afk]
      | to use this view.

  div(v-else-if="loading")
    b-spinner.mr-2(small)
    span.text-muted Computing trends over {{ periodDays }} + {{ periodDays }} days…

  div(v-else)
    b-row.mb-3
      b-col(md="4")
        b-card.h-100
          small.text-muted Active time
          h4.mb-0 {{ totalCurrent | friendlyduration }}
          div.small.mt-1(:class="deltaClass(totalDelta)")
            | {{ formatDelta(totalCurrent, totalPrevious) }} vs previous {{ periodDays }} days
      b-col(md="4")
        b-card.h-100
          small.text-muted Daily average
          h4.mb-0 {{ avgPerDay | friendlyduration }}
          div.small.mt-1(:class="deltaClass(avgDelta)")
            | {{ formatDelta(avgPerDay, avgPerDayPrevious) }} per day
      b-col(md="4")
        b-card.h-100
          small.text-muted Most-active day
          h4.mb-0(v-if="busiestDay") {{ busiestDay.label }}
          h4.mb-0.text-muted(v-else) —
          div.small.text-muted.mt-1(v-if="busiestDay") {{ busiestDay.duration | friendlyduration }} on this day

    h5.mt-3 Time per day
    aw-timeline-barchart(:datasets="datasets" :height="100")

    h5.mt-4 Top changes by category
    p.small.text-muted(v-if="categoryTrends.length === 0")
      | No categorized data to compare.
    b-table.mt-2(
      v-else
      small
      hover
      :items="categoryTrends"
      :fields="categoryFields"
      sort-by="absDelta"
      :sort-desc="true"
    )
      template(#cell(category)="row")
        | {{ row.item.category.join(' > ') || 'Uncategorized' }}
      template(#cell(current)="row")
        | {{ row.item.current | friendlyduration }}
      template(#cell(previous)="row")
        | {{ row.item.previous | friendlyduration }}
      template(#cell(delta)="row")
        span(:class="deltaClass(row.item.delta)")
          | {{ formatDelta(row.item.current, row.item.previous) }}
</template>

<style scoped lang="scss">
.h4 {
  font-weight: 600;
}
</style>

<script lang="ts">
import moment from 'moment';
import { get_today_with_offset } from '~/util/time';
import { buildBarchartDataset } from '~/util/datasets';
import { canonicalEvents } from '~/queries';
import { getClient } from '~/util/awclient';
import { useBucketsStore } from '~/stores/buckets';
import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';

interface CategoryTotals {
  [key: string]: number;
}

interface CategoryTrend {
  category: string[];
  current: number;
  previous: number;
  delta: number;
  absDelta: number;
}

export default {
  name: 'Trends',
  data() {
    return {
      bucketsStore: useBucketsStore(),
      categoryStore: useCategoryStore(),
      settingsStore: useSettingsStore(),

      periodDays: 7,
      periodOptions: [
        { value: 7, text: '7 days' },
        { value: 30, text: '30 days' },
        { value: 90, text: '90 days' },
      ],

      loading: false,

      // Per-day events for the current period (used for the barchart).
      byPeriod: null as Record<string, any> | null,

      // Per-category totals for current and previous periods.
      currentTotals: {} as CategoryTotals,
      previousTotals: {} as CategoryTotals,

      categoryFields: [
        { key: 'category', label: 'Category', sortable: true },
        { key: 'current', label: 'Current', class: 'text-right', sortable: true },
        { key: 'previous', label: 'Previous', class: 'text-right', sortable: true },
        { key: 'delta', label: 'Change', class: 'text-right', sortable: true },
        { key: 'absDelta', label: '', class: 'd-none', sortable: true },
      ],
    };
  },

  computed: {
    host(): string | undefined {
      return this.$route.params.host || this.bucketsStore.hosts[0];
    },

    hostOptions(): { value: string; text: string }[] {
      return this.bucketsStore.hosts.map(h => ({ value: h, text: h }));
    },

    today(): string {
      return get_today_with_offset(this.settingsStore.startOfDay);
    },

    currentStart(): moment.Moment {
      return moment(this.today).subtract(this.periodDays - 1, 'days');
    },

    currentRangeLabel(): string {
      const start = this.currentStart.format('MMM D');
      const end = moment(this.today).format('MMM D');
      return `${start} – ${end}`;
    },

    previousRangeLabel(): string {
      const start = this.currentStart.clone().subtract(this.periodDays, 'days').format('MMM D');
      const end = moment(this.today).subtract(this.periodDays, 'days').format('MMM D');
      return `${start} – ${end}`;
    },

    totalCurrent(): number {
      return Object.values(this.currentTotals as CategoryTotals).reduce(
        (a: number, b: number) => a + b,
        0
      );
    },

    totalPrevious(): number {
      return Object.values(this.previousTotals as CategoryTotals).reduce(
        (a: number, b: number) => a + b,
        0
      );
    },

    totalDelta(): number {
      return this.totalCurrent - this.totalPrevious;
    },

    avgPerDay(): number {
      return this.periodDays > 0 ? this.totalCurrent / this.periodDays : 0;
    },

    avgPerDayPrevious(): number {
      return this.periodDays > 0 ? this.totalPrevious / this.periodDays : 0;
    },

    avgDelta(): number {
      return this.avgPerDay - this.avgPerDayPrevious;
    },

    busiestDay(): { label: string; duration: number } | null {
      if (!this.byPeriod) return null;
      let best: { label: string; duration: number } | null = null;
      for (const [period, entry] of Object.entries(this.byPeriod)) {
        const evts: any[] = (entry as any)?.cat_events || [];
        const total = evts.reduce((a, e) => a + (e.duration || 0), 0);
        if (!best || total > best.duration) {
          const start = period.split('/')[0];
          best = { label: moment(start).format('ddd, MMM D'), duration: total };
        }
      }
      return best && best.duration > 0 ? best : null;
    },

    datasets(): any {
      if (this.loading) return [];
      if (!this.byPeriod) return null;
      const built = buildBarchartDataset(this.byPeriod, this.categoryStore.classes);
      return built.length > 0 ? built : null;
    },

    categoryTrends(): CategoryTrend[] {
      const cats = new Set([
        ...Object.keys(this.currentTotals),
        ...Object.keys(this.previousTotals),
      ]);
      const rows: CategoryTrend[] = [];
      for (const key of cats) {
        const current = this.currentTotals[key] || 0;
        const previous = this.previousTotals[key] || 0;
        // Skip categories under 5 minutes in both windows — noise.
        if (current < 300 && previous < 300) continue;
        const delta = current - previous;
        rows.push({
          category: JSON.parse(key),
          current,
          previous,
          delta,
          absDelta: Math.abs(delta),
        });
      }
      return rows;
    },
  },

  watch: {
    host() {
      this.refresh();
    },
  },

  async mounted() {
    await this.bucketsStore.ensureLoaded();
    await this.categoryStore.load();
    await this.refresh();
  },

  methods: {
    setPeriod(days: number) {
      this.periodDays = days;
      this.refresh();
    },

    onHostChange(value: string) {
      this.$router.replace(`/trends/${value}`);
    },

    deltaClass(delta: number): string {
      if (delta > 0) return 'text-success';
      if (delta < 0) return 'text-danger';
      return 'text-muted';
    },

    formatDelta(current: number, previous: number): string {
      const delta = current - previous;
      if (previous === 0) return delta > 0 ? '+new' : '0';
      const pct = (delta / previous) * 100;
      const sign = delta >= 0 ? '+' : '';
      return `${sign}${pct.toFixed(0)}%`;
    },

    async refresh() {
      if (!this.host) return;
      this.loading = true;
      try {
        const startCurrent = this.currentStart.clone();
        const endCurrent = moment(this.today).add(1, 'day');
        const startPrevious = startCurrent.clone().subtract(this.periodDays, 'days');
        const endPrevious = startCurrent.clone();

        const [currentByDay, previous] = await Promise.all([
          this.queryByDay(startCurrent, endCurrent),
          this.queryTotals(startPrevious, endPrevious),
        ]);

        this.byPeriod = currentByDay.byPeriod;
        this.currentTotals = currentByDay.totals;
        this.previousTotals = previous;
      } catch (e) {
        console.error('Trends refresh failed', e);
        this.byPeriod = {};
        this.currentTotals = {};
        this.previousTotals = {};
      } finally {
        this.loading = false;
      }
    },

    // Returns { byPeriod, totals } where byPeriod is the per-day event list
    // (for the barchart) and totals is the summed seconds per category over
    // the whole window.
    async queryByDay(
      start: moment.Moment,
      end: moment.Moment
    ): Promise<{ byPeriod: Record<string, any>; totals: CategoryTotals }> {
      const periods: string[] = [];
      const day = start.clone();
      while (day.isBefore(end)) {
        const nextDay = day.clone().add(1, 'day');
        periods.push(`${day.format()}/${nextDay.format()}`);
        day.add(1, 'day');
      }
      const query = this.buildCategoryQuery();
      const results: any[] = [];
      for (const period of periods) {
        const r = await getClient().query([period], query, { name: 'trendsByDay', verbose: true });
        results.push(r[0]);
      }
      const byPeriod: Record<string, any> = {};
      const totals: CategoryTotals = {};
      periods.forEach((p, i) => {
        const events = (results[i] && results[i].cat_events) || [];
        // buildBarchartDataset expects entries of the shape { cat_events: [] }
        byPeriod[p] = { cat_events: events };
        for (const e of events) {
          const key = JSON.stringify(e.data['$category'] || ['Uncategorized']);
          totals[key] = (totals[key] || 0) + (e.duration || 0);
        }
      });
      return { byPeriod, totals };
    },

    // Single-query totals (no day breakdown) for the previous window.
    async queryTotals(start: moment.Moment, end: moment.Moment): Promise<CategoryTotals> {
      const query = this.buildCategoryQuery();
      const period = `${start.format()}/${end.format()}`;
      const r = await getClient().query([period], query, { name: 'trendsTotals', verbose: true });
      const events = (r[0] && r[0].cat_events) || [];
      const totals: CategoryTotals = {};
      for (const e of events) {
        const key = JSON.stringify(e.data['$category'] || ['Uncategorized']);
        totals[key] = (totals[key] || 0) + (e.duration || 0);
      }
      return totals;
    },

    buildCategoryQuery(): string[] {
      const cats = this.categoryStore.classes_for_query;
      const code =
        canonicalEvents({
          bid_window: 'aw-watcher-window_' + this.host,
          bid_afk: 'aw-watcher-afk_' + this.host,
          filter_afk: true,
          categories: cats,
          filter_categories: null,
          always_active_pattern: this.settingsStore.always_active_pattern || undefined,
        }) +
        `
        cat_events = sort_by_duration(merge_events_by_keys(events, ["$category"]));
        RETURN = {"cat_events": cat_events};
      `;
      return code
        .split(';')
        .map(s => s.trim())
        .filter(s => s)
        .map(s => s + ';');
    },
  },
};
</script>
