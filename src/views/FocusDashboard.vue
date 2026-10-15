<template lang="pug">
div
  div.d-flex.flex-wrap.align-items-center.mb-3
    h3.mb-0.mr-3 Focus Dashboard

    b-button-group.mr-2.mb-1(size="sm")
      b-button.px-3(
        v-for="opt in periodOptions"
        :key="opt.value"
        :pressed="periodDays === opt.value"
        @click="setPeriod(opt.value)"
        variant="outline-dark"
      ) {{ opt.text }}

    b-form-select.mr-2.mb-1(
      v-if="bucketsStore.knownHosts.length > 1"
      size="sm"
      :value="host"
      :options="hostOptions"
      @change="onHostChange"
      style="width: auto"
    )

  div(v-if="!host")
    b-alert(show variant="info")
      | No host with window/AFK buckets available. Install
      | #[a(href="https://docs.activitywatch.net/en/latest/watchers.html") aw-watcher-window and aw-watcher-afk]
      | to use this view.

  div(v-else-if="noClassesConfigured")
    b-alert(show variant="warning")
      | No categories have a focus class assigned yet.
      | Go to #[b-link(to="/category-builder") Category Builder] and add a
      | #[code class] field (focus, operational, or distraction) to your leaf categories.

  div(v-else-if="loading")
    b-spinner.mr-2(small)
    span.text-muted Loading activity data…

  div(v-else-if="error")
    b-alert(show variant="danger") {{ error }}

  div(v-else)
    b-row.mb-4
      b-col(md="3" sm="6")
        b-card.h-100.text-center
          div.text-success.mb-1
            b-icon(icon="check-circle-fill" scale="1.5")
          small.text-muted Focus
          h4.mb-0.text-success {{ pct(focusSecs, totalSecs) }}
          div.small.text-muted {{ friendlyduration(focusSecs) }}
      b-col(md="3" sm="6")
        b-card.h-100.text-center
          div.text-danger.mb-1
            b-icon(icon="x-circle-fill" scale="1.5")
          small.text-muted Distraction
          h4.mb-0.text-danger {{ pct(distractionSecs, totalSecs) }}
          div.small.text-muted {{ friendlyduration(distractionSecs) }}
      b-col(md="3" sm="6")
        b-card.h-100.text-center
          div.text-secondary.mb-1
            b-icon(icon="gear-fill" scale="1.5")
          small.text-muted Operational
          h4.mb-0 {{ pct(operationalSecs, totalSecs) }}
          div.small.text-muted {{ friendlyduration(operationalSecs) }}
      b-col(md="3" sm="6")
        b-card.h-100.text-center
          div.text-muted.mb-1
            b-icon(icon="question-circle-fill" scale="1.5")
          small.text-muted Unclassified
          h4.mb-0.text-muted {{ pct(unclassifiedSecs, totalSecs) }}
          div.small.text-muted {{ friendlyduration(unclassifiedSecs) }}

    b-row.mb-4
      b-col(md="4" sm="6")
        b-card.h-100
          template(#header)
            strong Context Switches
          h3.mb-0 {{ contextSwitches }}
          small.text-muted focus ↔ distraction transitions in {{ periodDays }} days
          div.small.text-muted.mt-1(v-if="contextSwitches > 0")
            | ~{{ (contextSwitches / periodDays).toFixed(1) }} per day
      b-col(md="4" sm="6")
        b-card.h-100
          template(#header)
            strong Avg Attention Span
          h3.mb-0 {{ friendlyduration(avgFocusSpanSecs) }}
          small.text-muted per continuous focus period
          div.small.text-muted.mt-1(v-if="focusSpanCount > 0")
            | {{ focusSpanCount }} focus period{{ focusSpanCount === 1 ? '' : 's' }} total
      b-col(md="4" sm="6")
        b-card.h-100
          template(#header)
            strong Focus Score
          h3.mb-0
            span(:class="focusScoreClass") {{ focusScore }}
          small.text-muted focus ratio out of 100 (excl. operational)
          b-progress.mt-2(:value="focusScoreRaw" :max="100" :variant="focusScoreVariant" style="height:8px")

    h5.mt-2 Time by Category Class
    b-table.mt-2(
      small
      hover
      responsive
      :items="categoryRows"
      :fields="categoryFields"
      sort-by="secs"
      :sort-desc="true"
    )
      template(#cell(class)="row")
        b-badge(:variant="classVariant(row.item.class)") {{ row.item.class || 'unclassified' }}
      template(#cell(secs)="row")
        | {{ friendlyduration(row.item.secs) }}
      template(#cell(pct)="row")
        | {{ pct(row.item.secs, totalSecs) }}

</template>

<style scoped lang="scss">
.h3 {
  font-weight: 600;
}
</style>

<script lang="ts">
import moment from 'moment';
import { canonicalEvents, querystr_to_array } from '~/queries';
import { useBucketsStore } from '~/stores/buckets';
import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';
import { getClient } from '~/util/awclient';
import { get_today_with_offset } from '~/util/time';

type FocusClass = 'focus' | 'operational' | 'distraction' | null;

interface CategoryRow {
  category: string;
  class: FocusClass;
  secs: number;
  pct: string;
}

export default {
  name: 'FocusDashboard',

  props: {
    host: { type: String, default: null },
  },

  data() {
    return {
      bucketsStore: useBucketsStore(),
      categoryStore: useCategoryStore(),
      settingsStore: useSettingsStore(),

      periodDays: 7,
      periodOptions: [
        { value: 1, text: '1 day' },
        { value: 7, text: '7 days' },
        { value: 30, text: '30 days' },
      ],

      loading: false,
      error: null as string | null,

      // Raw event spans: array of { cat: string[], class: FocusClass, duration: number }
      spans: [] as { cat: string[]; cls: FocusClass; duration: number }[],

      // For context-switch / attention-span metrics
      timeline: [] as { timestamp: string; cls: FocusClass }[],
    };
  },

  computed: {
    hostOptions(): { value: string; text: string }[] {
      return this.bucketsStore.knownHosts.map((h: string) => ({ value: h, text: h }));
    },

    noClassesConfigured(): boolean {
      return this.categoryStore.classes.every((c: any) => !c.data?.class);
    },

    /** Seconds per focus class */
    focusSecs(): number {
      return this.spans.filter(s => s.cls === 'focus').reduce((a, s) => a + s.duration, 0);
    },
    distractionSecs(): number {
      return this.spans.filter(s => s.cls === 'distraction').reduce((a, s) => a + s.duration, 0);
    },
    operationalSecs(): number {
      return this.spans.filter(s => s.cls === 'operational').reduce((a, s) => a + s.duration, 0);
    },
    unclassifiedSecs(): number {
      return this.spans.filter(s => s.cls === null).reduce((a, s) => a + s.duration, 0);
    },
    totalSecs(): number {
      return this.focusSecs + this.distractionSecs + this.operationalSecs + this.unclassifiedSecs;
    },

    /** Focus score: focus / (focus + distraction) * 100, ignoring operational */
    focusScoreRaw(): number {
      const denominator = this.focusSecs + this.distractionSecs;
      if (denominator === 0) return 0;
      return Math.round((this.focusSecs / denominator) * 100);
    },
    focusScore(): string {
      return `${this.focusScoreRaw}/100`;
    },
    focusScoreVariant(): string {
      if (this.focusScoreRaw >= 70) return 'success';
      if (this.focusScoreRaw >= 40) return 'warning';
      return 'danger';
    },
    focusScoreClass(): string {
      if (this.focusScoreRaw >= 70) return 'text-success';
      if (this.focusScoreRaw >= 40) return 'text-warning';
      return 'text-danger';
    },

    /** Context switches: transitions between focus and distraction in timeline */
    contextSwitches(): number {
      let switches = 0;
      const meaningful = this.timeline.filter(t => t.cls === 'focus' || t.cls === 'distraction');
      for (let i = 1; i < meaningful.length; i++) {
        if (meaningful[i].cls !== meaningful[i - 1].cls) switches++;
      }
      return switches;
    },

    /** Average focus span duration in seconds */
    focusSpans(): number[] {
      const spans: number[] = [];
      let current: string | null = null;
      let start = 0;
      for (const [i, t] of this.timeline.entries()) {
        if (t.cls === 'focus' && current !== 'focus') {
          start = i;
          current = 'focus';
        } else if (t.cls !== 'focus' && current === 'focus') {
          // approximation: count events in span
          spans.push(i - start);
          current = null;
        }
      }
      return spans;
    },
    focusSpanCount(): number {
      return this.focusSpans.length;
    },
    avgFocusSpanSecs(): number {
      if (this.focusSpans.length === 0) return 0;
      // Use actual seconds from spans
      const totalFocus = this.focusSecs;
      const count = this.focusSpans.length;
      return count > 0 ? totalFocus / count : 0;
    },

    /** Category breakdown rows for table */
    categoryRows(): CategoryRow[] {
      const grouped: Record<string, { cls: FocusClass; secs: number }> = {};
      for (const s of this.spans) {
        const key = s.cat.join(' > ') || 'Uncategorized';
        if (!grouped[key]) grouped[key] = { cls: s.cls, secs: 0 };
        grouped[key].secs += s.duration;
      }
      return Object.entries(grouped)
        .map(([category, { cls, secs }]) => ({
          category,
          class: cls,
          secs,
          pct: this.pct(secs, this.totalSecs),
        }))
        .sort((a, b) => b.secs - a.secs);
    },

    categoryFields(): object[] {
      return [
        { key: 'category', label: 'Category', sortable: true },
        { key: 'class', label: 'Class', sortable: true },
        { key: 'secs', label: 'Duration', sortable: true },
        { key: 'pct', label: '%', sortable: false },
      ];
    },
  },

  watch: {
    host() {
      this.refresh();
    },
    periodDays() {
      this.refresh();
    },
  },

  async mounted() {
    await this.bucketsStore.loadBuckets();
    await this.categoryStore.load();
    if (this.host) this.refresh();
  },

  methods: {
    setPeriod(days: number) {
      this.periodDays = days;
    },

    onHostChange(h: string) {
      this.$router.push({ path: `/focus/${h}` });
    },

    pct(part: number, total: number): string {
      if (!total) return '—';
      return `${Math.round((part / total) * 100)}%`;
    },

    friendlyduration(secs: number): string {
      if (!secs) return '—';
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m`;
    },

    classVariant(cls: FocusClass): string {
      return (
        { focus: 'success', distraction: 'danger', operational: 'secondary' }[cls ?? ''] ?? 'light'
      );
    },

    /** Resolve a category name array to its focus class from the store */
    resolveClass(catName: string[]): FocusClass {
      const classes: any[] = this.categoryStore.classes;
      // Find most-specific matching category
      for (let depth = catName.length; depth > 0; depth--) {
        const sub = catName.slice(0, depth);
        const cat = classes.find((c: any) => {
          const n = c.name as string[];
          return n.length === sub.length && n.every((v, i) => v === sub[i]);
        });
        if (cat && cat.data?.class) return cat.data.class as FocusClass;
      }
      return null;
    },

    async refresh() {
      if (!this.host) return;
      this.loading = true;
      this.error = null;
      this.spans = [];
      this.timeline = [];

      try {
        const startDate = get_today_with_offset(-this.periodDays);

        // Build query using the same canonical approach as other views
        const cats = this.categoryStore.classes_for_query;
        const queryCode =
          canonicalEvents({
            ...this.bucketsStore.desktopBucketIds(this.host),
            filter_afk: true,
            categories: cats,
            filter_categories: null,
            always_active_pattern: this.settingsStore.always_active_pattern || undefined,
          }) + 'RETURN = events;';
        const query = querystr_to_array(queryCode);

        // Query one timeperiod per day for the period
        const timeperiods: string[][] = [];
        for (let d = 0; d < this.periodDays; d++) {
          const start = moment(startDate).add(d, 'days').toISOString();
          const end = moment(startDate)
            .add(d + 1, 'days')
            .toISOString();
          timeperiods.push([start, end]);
        }

        const result = await getClient().query(timeperiods, query);

        // Flatten events and compute class spans
        const spans: typeof this.spans = [];
        const timeline: typeof this.timeline = [];
        for (const dayEvents of result) {
          for (const ev of dayEvents) {
            const cat: string[] = ev.data?.$category ?? [];
            const cls = this.resolveClass(cat);
            const duration = ev.duration ?? 0;
            spans.push({ cat, cls, duration });
            timeline.push({ timestamp: ev.timestamp, cls });
          }
        }

        // Sort timeline by timestamp for context-switch calculation
        timeline.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));

        this.spans = spans;
        this.timeline = timeline;
      } catch (e: any) {
        this.error = e?.message ?? String(e);
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>
