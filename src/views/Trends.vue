<template lang="pug">
div
  div.d-flex.flex-wrap.align-items-center.mb-3
    h3.mb-0.me-3 {{ $t('nav.trends') }}

    b-button-group.me-2.mb-1(size="sm")
      b-button.px-3(
        v-for="opt in periodOptions"
        :key="opt.value"
        :pressed="periodDays === opt.value"
        @click="setPeriod(opt.value)"
        variant="outline-dark"
      ) {{ opt.text }}

    b-form-select.me-2.mb-1(
      v-if="bucketsStore.knownHosts.length > 1"
      size="sm"
      :value="host"
      :options="hostOptions"
      @change="onHostChange"
      style="width: auto"
    )

    small.text-muted.ms-auto.mb-1
      | {{ $t('ui.trends.comparing') }} #[b {{ currentRangeLabel }}] {{ $t('ui.trends.vs') }} #[b {{ previousRangeLabel }}]

  div(v-if="!host")
    b-alert(show variant="info")
      | {{ $t('ui.trends.noHost') }}
      | #[a(href="https://docs.activitywatch.net/en/latest/watchers.html") aw-watcher-window and aw-watcher-afk]
      | {{ $t('extraViews.trends.toUse') }}

  div(v-else-if="loading")
    b-spinner.me-2(small)
    span.text-muted {{ $t('ui.trends.computing', { days: periodDays }) }}

  div(v-else)
    b-row.mb-3
      b-col(md="4")
        b-card.h-100
          small.text-muted {{ $t('ui.trends.activeTime') }}
          h4.mb-0 {{ friendlyduration(totalCurrent) }}
          div.small.mt-1(:class="deltaClass(totalDelta)")
            | {{ $t('ui.trends.vsPrevious', { days: periodDays }) }}: {{ formatDelta(totalCurrent, totalPrevious) }}
      b-col(md="4")
        b-card.h-100
          small.text-muted {{ $t('ui.trends.dailyAverage') }}
          h4.mb-0 {{ friendlyduration(avgPerDay) }}
          div.small.mt-1(:class="deltaClass(avgDelta)")
            | {{ formatDelta(avgPerDay, avgPerDayPrevious) }} {{ $t('ui.trends.perDay') }}
      b-col(md="4")
        b-card.h-100
          small.text-muted {{ $t('ui.trends.mostActiveDay') }}
          h4.mb-0(v-if="busiestDay") {{ busiestDay.label }}
          h4.mb-0.text-muted(v-else) —
          div.small.text-muted.mt-1(v-if="busiestDay") {{ friendlyduration(busiestDay.duration) }} {{ $t('ui.trends.onThisDay') }}

    h5.mt-3 {{ $t('ui.trends.timePerDay') }}
    aw-timeline-barchart(:datasets="datasets" :height="100" :timeperiod_start="currentStart.toISOString()" :timeperiod_length="[periodDays, 'days']")

    h5.mt-4 {{ $t('ui.trends.topChanges') }}
    p.small.text-muted(v-if="categoryTrends.length === 0")
      | {{ $t('ui.trends.noData') }}
    b-table.mt-2(
      v-else
      small
      hover
      responsive
      :items="categoryTrends"
      :fields="categoryFields"
      sort-by="absDelta"
      :sort-desc="true"
    )
      template(#cell(category)="row")
        | {{ row.item.category.join(' > ') || $t('common.uncategorized') }}
      template(#cell(current)="row")
        | {{ friendlyduration(row.item.current) }}
      template(#cell(previous)="row")
        | {{ friendlyduration(row.item.previous) }}
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
import {
  get_today_with_offset,
  get_day_start_with_offset,
  format_date_short,
  format_date_with_weekday,
} from '~/util/time';
import { buildBarchartDataset } from '~/util/datasets';
import { canonicalEvents, querystr_to_array } from '~/queries';
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

      loading: false,

      // Incremented for every refresh. Only the latest refresh may write the
      // rendered state; older in-flight responses are discarded.
      refreshGeneration: 0,

      // Per-day events for the current period (used for the barchart).
      byPeriod: null as Record<string, any> | null,

      // Per-category totals for current and previous periods.
      currentTotals: {} as CategoryTotals,
      previousTotals: {} as CategoryTotals,
    };
  },

  computed: {
    periodOptions(): { value: number; text: string }[] {
      return [
        { value: 7, text: this.$t('ui.trends.period7d') },
        { value: 30, text: this.$t('ui.trends.period30d') },
        { value: 90, text: this.$t('ui.trends.period90d') },
      ];
    },

    categoryFields(): object[] {
      return [
        { key: 'category', label: this.$t('ui.trends.tableCategory'), sortable: true },
        {
          key: 'current',
          label: this.$t('ui.trends.tableCurrent'),
          class: 'text-right text-nowrap',
          sortable: true,
        },
        {
          key: 'previous',
          label: this.$t('ui.trends.tablePrevious'),
          class: 'text-right text-nowrap',
          sortable: true,
        },
        {
          key: 'delta',
          label: this.$t('ui.trends.tableChange'),
          class: 'text-right text-nowrap',
          sortable: true,
        },
        { key: 'absDelta', label: '', class: 'd-none', sortable: true },
      ];
    },

    host(): string | undefined {
      // Ignore a :host param that is no longer offered in the select (e.g. a
      // stale /trends/unknown URL, or a device that disappeared). Otherwise the
      // select is hidden and the user is stuck querying a host they cannot see.
      const routeHost = this.$route.params.host;
      const hosts = this.bucketsStore.knownHosts;
      return routeHost && hosts.includes(routeHost) ? routeHost : hosts[0];
    },

    hostOptions(): { value: string; text: string }[] {
      return this.bucketsStore.knownHosts.map(h => ({ value: h, text: h }));
    },

    today(): string {
      return get_today_with_offset(this.settingsStore.startOfDay);
    },

    currentStart(): moment.Moment {
      return moment(this.today).subtract(this.periodDays - 1, 'days');
    },

    currentRangeLabel(): string {
      const start = format_date_short(this.currentStart.toDate());
      const end = format_date_short(moment(this.today).toDate());
      return `${start} – ${end}`;
    },

    previousRangeLabel(): string {
      const start = format_date_short(
        this.currentStart.clone().subtract(this.periodDays, 'days').toDate()
      );
      const end = format_date_short(moment(this.today).subtract(this.periodDays, 'days').toDate());
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
          best = { label: format_date_with_weekday(new Date(start)), duration: total };
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
      if (previous === 0) return delta > 0 ? this.$t('ui.trends.new') : '0';
      const pct = (delta / previous) * 100;
      const sign = delta >= 0 ? '+' : '';
      return `${sign}${pct.toFixed(0)}%`;
    },

    async refresh() {
      // Snapshot the request inputs: the selection can change while the
      // queries are in flight, and a refresh must keep querying the host and
      // range it started with.
      const generation = (this.refreshGeneration || 0) + 1;
      this.refreshGeneration = generation;

      if (!this.host) {
        this.loading = false;
        return;
      }

      const host = this.host;
      const periodDays = this.periodDays;
      const today = this.today;
      const startCurrent = this.currentStart.clone();
      const endCurrent = moment(today).add(1, 'day');
      const startPrevious = startCurrent.clone().subtract(periodDays, 'days');
      const endPrevious = startCurrent.clone();

      const isCurrent = () => generation === this.refreshGeneration;

      this.loading = true;
      try {
        const [currentByDay, previous] = await Promise.all([
          this.queryByDay(host, startCurrent, endCurrent, isCurrent),
          this.queryTotals(host, startPrevious, endPrevious),
        ]);

        if (!isCurrent()) return;

        this.byPeriod = currentByDay.byPeriod;
        this.currentTotals = currentByDay.totals;
        this.previousTotals = previous;
      } catch (e) {
        if (!isCurrent()) return;
        console.error('Trends refresh failed', e);
        this.byPeriod = {};
        this.currentTotals = {};
        this.previousTotals = {};
      } finally {
        if (isCurrent()) this.loading = false;
      }
    },

    // Day windows honour the configured start of day (default 04:00) like the
    // Activity view does. Slicing at calendar midnight dropped the user's
    // after-midnight activity from the current window and shifted every bar.
    dayPeriods(start: moment.Moment, end: moment.Moment): string[] {
      const offset = this.settingsStore.startOfDay;
      const periods: string[] = [];
      const day = start.clone();
      while (day.isBefore(end)) {
        const nextDay = day.clone().add(1, 'day');
        periods.push(
          `${get_day_start_with_offset(day, offset)}/${get_day_start_with_offset(nextDay, offset)}`
        );
        day.add(1, 'day');
      }
      return periods;
    },

    // Returns { byPeriod, totals } where byPeriod is the per-day event list
    // (for the barchart) and totals is the summed seconds per category over
    // the whole window.
    async queryByDay(
      host: string,
      start: moment.Moment,
      end: moment.Moment,
      isCurrent: () => boolean = () => true
    ): Promise<{ byPeriod: Record<string, any>; totals: CategoryTotals }> {
      const periods = this.dayPeriods(start, end);
      const query = this.buildCategoryQuery(host);
      const results: any[] = [];
      for (const period of periods) {
        const r = await getClient().query([period], query, { name: 'trendsByDay', verbose: true });
        results.push(r[0]);
        // The refresh was superseded (host removed or selection changed):
        // stop spending day queries on a response that will be discarded.
        if (!isCurrent()) break;
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
    async queryTotals(
      host: string,
      start: moment.Moment,
      end: moment.Moment
    ): Promise<CategoryTotals> {
      const query = this.buildCategoryQuery(host);
      const offset = this.settingsStore.startOfDay;
      const period = `${get_day_start_with_offset(start, offset)}/${get_day_start_with_offset(
        end,
        offset
      )}`;
      const r = await getClient().query([period], query, { name: 'trendsTotals', verbose: true });
      const events = (r[0] && r[0].cat_events) || [];
      const totals: CategoryTotals = {};
      for (const e of events) {
        const key = JSON.stringify(e.data['$category'] || ['Uncategorized']);
        totals[key] = (totals[key] || 0) + (e.duration || 0);
      }
      return totals;
    },

    buildCategoryQuery(host: string): string[] {
      const cats = this.categoryStore.classes_for_query;
      const code =
        canonicalEvents({
          ...this.bucketsStore.desktopBucketIds(host),
          filter_afk: true,
          categories: cats,
          filter_categories: null,
          always_active_pattern: this.settingsStore.always_active_pattern || undefined,
        }) +
        `
        cat_events = sort_by_duration(merge_events_by_keys(events, ["$category"]));
        RETURN = {"cat_events": cat_events};
      `;
      return querystr_to_array(code);
    },
  },
};
</script>
