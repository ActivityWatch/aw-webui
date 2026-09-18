<template lang="pug">
div
  h3 {{ $t('timeline.title') }}

  input-timeinterval(v-model="daterange", :defaultDuration="timeintervalDefaultDuration", :maxDuration="maxDuration").mb-3

  // Toolbar: filters (primary), display kebab (swimlanes etc.), event count,
  // and keyboard hint. Flex-wrap so it doesn't overlap at narrow widths.
  div.timeline-toolbar.d-flex.flex-wrap.align-items-center
    details.timeline-filters.mr-2(ref="filtersDetails", @toggle="onFiltersToggle")
      summary.timeline-chip.timeline-chip--clickable
        icon.mr-1(name="filter")
        b Filters: {{ filter_summary }}
      div.timeline-filters-panel.shadow-sm
        div.timeline-filter-actions
          button.btn.btn-outline-secondary.btn-sm.timeline-filter-reset(type="button", @click.stop.prevent="resetFilterChanges") Reset
          button.btn.btn-primary.btn-sm(type="button", @click.stop.prevent="applyFilterChanges") Confirm
          button.btn.btn-outline-secondary.btn-sm(type="button", @click.stop.prevent="cancelFilterChanges") Cancel
        table
          tr
            th.pr-3
              label(for="timeline-filter-duration") Duration:
            td
              div.timeline-duration-control
                div.timeline-duration-inputs
                  div.timeline-duration-field
                    input#timeline-filter-duration-min.form-control.form-control-sm(
                      type="number"
                      min="0"
                      step="any"
                      v-model.number="pending_filter_duration_min"
                      placeholder="Min"
                      aria-label="Minimum duration"
                      @input="clearDurationRangeError"
                    )
                    select.form-control.form-control-sm(
                      v-model="pending_filter_duration_min_unit"
                      aria-label="Minimum duration unit"
                      @change="clearDurationRangeError"
                    )
                      option(v-for="unit in durationUnitOptions", :key="unit.value", :value="unit.value") {{ unit.text }}
                  span.timeline-duration-separator –
                  div.timeline-duration-field
                    input#timeline-filter-duration-max.form-control.form-control-sm(
                      type="number"
                      min="0"
                      step="any"
                      v-model.number="pending_filter_duration_max"
                      placeholder="Max"
                      aria-label="Maximum duration"
                      @input="clearDurationRangeError"
                    )
                    select.form-control.form-control-sm(
                      v-model="pending_filter_duration_max_unit"
                      aria-label="Maximum duration unit"
                      @change="clearDurationRangeError"
                    )
                      option(v-for="unit in durationUnitOptions", :key="unit.value", :value="unit.value") {{ unit.text }}
                small.timeline-duration-error.text-danger(v-if="duration_range_error_visible && duration_range_invalid")
                  | Minimum duration cannot exceed maximum duration.
          tr
            th
            td
              div.timeline-filter-toggles
                label.timeline-filter-toggle
                  input(type="checkbox", v-model="pending_filter_afk")
                  span {{ $t('timeline.filterAfk') }}
                label.timeline-filter-toggle
                  input(type="checkbox", v-model="pending_filter_merge_similar")
                  span {{ $t('timeline.mergeByApp') }}
          tr
            th.pr-3
              label Host:
            td
              div.timeline-filter-options(v-if="hosts.length > 0")
                label.timeline-filter-option(:title="'ALL'")
                  input(type="checkbox", :checked="all_pending_hosts_selected", @change="toggleAllPendingHosts")
                  span.timeline-filter-option-label ALL
                label.timeline-filter-option(v-for="host in hosts", :key="host", :title="host")
                  input(type="checkbox", v-model="pending_filter_hostnames", :value="host")
                  span.timeline-filter-option-label {{ host }}
          tr
            th.pr-3
              label Client:
            td
              div.timeline-filter-options(v-if="clients.length > 0")
                label.timeline-filter-option(:title="'ALL'")
                  input(type="checkbox", :checked="all_pending_clients_selected", @change="toggleAllPendingClients")
                  span.timeline-filter-option-label ALL
                label.timeline-filter-option(v-for="client in clients", :key="client", :title="client")
                  input(type="checkbox", v-model="pending_filter_clients", :value="client")
                  span.timeline-filter-option-label {{ client }}
          tr
            th.pr-3
              label Categories:
            td
              div.timeline-filter-options(v-if="category_options.length > 0")
                label.timeline-filter-option(:title="'ALL'")
                  input(type="checkbox", :checked="all_pending_categories_selected", @change="toggleAllPendingCategories")
                  span.timeline-filter-option-label ALL
                label.timeline-filter-option(v-for="cat in category_options", :key="cat.text", :title="cat.text")
                  input(type="checkbox", :checked="isPendingCategorySelected(cat.value)", @change="togglePendingCategory(cat.value)")
                  span.timeline-filter-option-label {{ cat.text }}

    // Display options (swimlanes, future visual toggles) tucked behind a
    // ghost kebab so they don't compete visually with Filters.
    b-dropdown.kebab-dropdown.mr-2(
      size="sm"
      variant="outline-secondary"
      toggle-class="border-0"
      no-caret
      right
      title="Display options"
      aria-label="Display options"
    )
      template(v-slot:button-content="slotProps")
        icon(name="ellipsis-v")
      b-dropdown-header Swimlanes
      b-dropdown-item-button(
        v-for="opt in swimlaneOptions"
        :key="String(opt.value)"
        :active="swimlane === opt.value"
        @click="swimlane = opt.value"
      ) {{ opt.text }}

    div.timeline-chip.mr-2.text-muted
      | {{ num_events }} {{ $t('timeline.eventsShown') }}

    small.text-muted.ml-auto
      | {{ $t('timeline.scrollHint') }}

  b-alert.mb-2(v-if="buckets !== null && num_events === 0", variant="warning", show)
    | {{ $t('timeline.noEvents') }}

  div(v-if="buckets !== null")
    vis-timeline(:buckets="buckets", :showRowLabels='true', :queriedInterval="daterange", :swimlane="swimlane", :updateTimelineWindow='updateTimelineWindow')

    aw-devonly(reason="Not ready for production, still experimenting")
      aw-calendar(:buckets="buckets")
  div(v-else)
    h1.aw-loading {{ $t('common.loading') }}
</template>

<script lang="ts">
import 'vue-awesome/icons/filter';
import 'vue-awesome/icons/ellipsis-v';
import _ from 'lodash';
import { mapState } from 'pinia';
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';
import { getClient } from '~/util/awclient';
import { canonicalEvents, querystr_to_array } from '~/queries';
import { useCategoryStore } from '~/stores/categories';
import { matchString } from '~/util/classes';
import { getCategorizationStringFromEvent } from '~/util/color';
import { seconds_to_duration } from '~/util/time';

export default {
  name: 'Timeline',
  data() {
    return {
      all_buckets: null,
      hosts: [],
      buckets: null,
      clients: [],
      daterange: null,
      maxDuration: 31 * 24 * 60 * 60,
      filter_hostnames: [],
      filter_clients: [],
      pending_filter_hostnames: [],
      pending_filter_clients: [],
      host_filter_initialized: false,
      client_filter_initialized: false,
      filter_duration_min: null,
      filter_duration_max: null,
      filter_duration_min_unit: 'seconds',
      filter_duration_max_unit: 'seconds',
      pending_filter_duration_min: null,
      pending_filter_duration_max: null,
      pending_filter_duration_min_unit: 'seconds',
      pending_filter_duration_max_unit: 'seconds',
      duration_range_error_visible: false,
      durationUnitOptions: [
        { value: 'seconds', text: 'seconds' },
        { value: 'minutes', text: 'minutes' },
        { value: 'hours', text: 'hours' },
      ],
      filter_afk: false,
      pending_filter_afk: false,
      filter_merge_similar: false,
      pending_filter_merge_similar: false,
      filter_categories: [],
      pending_filter_categories: [],
      category_filter_initialized: false,
      buckets_refresh_scheduled: false,
      swimlane: null,
      swimlaneOptions: [
        { value: null, text: 'None' },
        { value: 'category', text: 'Group by category' },
        { value: 'bucketType', text: 'Group by bucket type' },
      ],
      updateTimelineWindow: true,
      // Keep the first chart render on the queried interval while filters initialize.
      is_initial_timeline_load: true,
    };
  },
  computed: {
    ...mapState(useSettingsStore, ['always_active_pattern']),
    timeintervalDefaultDuration() {
      const settingsStore = useSettingsStore();
      return Number(settingsStore.durationDefault);
    },
    // This does not match the chartData which is rendered in the timeline, as chartData excludes short events.
    num_events() {
      return _.sumBy(this.buckets, 'events.length');
    },
    category_options() {
      const categoryStore = useCategoryStore();
      return categoryStore.allCategoriesSelect;
    },
    all_hosts_selected() {
      return (
        this.hosts.length > 0 &&
        this.filter_hostnames.length === this.hosts.length &&
        this.hosts.every(host => this.filter_hostnames.includes(host))
      );
    },
    all_clients_selected() {
      return (
        this.clients.length > 0 &&
        this.filter_clients.length === this.clients.length &&
        this.clients.every(client => this.filter_clients.includes(client))
      );
    },
    all_categories_selected() {
      return (
        this.category_options.length > 0 &&
        this.filter_categories.length === this.category_options.length &&
        this.category_options.every(category => this.isCategorySelected(category.value))
      );
    },
    all_pending_hosts_selected() {
      return (
        this.hosts.length > 0 &&
        this.pending_filter_hostnames.length === this.hosts.length &&
        this.hosts.every(host => this.pending_filter_hostnames.includes(host))
      );
    },
    all_pending_clients_selected() {
      return (
        this.clients.length > 0 &&
        this.pending_filter_clients.length === this.clients.length &&
        this.clients.every(client => this.pending_filter_clients.includes(client))
      );
    },
    all_pending_categories_selected() {
      return (
        this.category_options.length > 0 &&
        this.pending_filter_categories.length === this.category_options.length &&
        this.category_options.every(category => this.isPendingCategorySelected(category.value))
      );
    },
    duration_range_invalid() {
      const min = this.normalizeDuration(
        this.pending_filter_duration_min,
        this.pending_filter_duration_min_unit
      );
      const max = this.normalizeDuration(
        this.pending_filter_duration_max,
        this.pending_filter_duration_max_unit
      );
      return min !== null && max !== null && min > max;
    },
    filter_summary() {
      const desc = [];
      if (this.filter_hostnames.length > 0 && !this.all_hosts_selected) {
        desc.push(
          this.filter_hostnames.length > 1
            ? `${this.filter_hostnames.length} Hosts`
            : this.filter_hostnames[0]
        );
      }
      if (this.filter_clients.length > 0 && !this.all_clients_selected) {
        desc.push(
          this.filter_clients.length > 1
            ? `${this.filter_clients.length} Clients`
            : this.filter_clients[0]
        );
      }
      if (this.duration_filter_summary) {
        desc.push(this.duration_filter_summary);
      }
      if (this.filter_afk) {
        desc.push('AFK filtered');
      }
      if (this.filter_merge_similar) {
        desc.push('merged by app');
      }
      if (this.filter_categories.length > 0 && !this.all_categories_selected) {
        desc.push(
          this.filter_categories.length > 1
            ? `${this.filter_categories.length} Categories`
            : '1 category'
        );
      }

      if (desc.length > 0) {
        return desc.join(', ');
      }
      return 'none';
    },
    duration_filter_summary() {
      const min = this.filter_duration_min;
      const max = this.filter_duration_max;
      if (min !== null && max !== null) {
        return `${seconds_to_duration(min)} - ${seconds_to_duration(max)}`;
      }
      if (min !== null) {
        return `>= ${seconds_to_duration(min)}`;
      }
      if (max !== null) {
        return `<= ${seconds_to_duration(max)}`;
      }
      return null;
    },
  },
  watch: {
    daterange() {
      this.updateTimelineWindow = true;
      this.getBuckets();
    },
    filter_hostnames() {
      this.handleAppliedFilterChange();
    },
    filter_clients() {
      this.handleAppliedFilterChange();
    },
    filter_duration_min() {
      this.handleAppliedFilterChange();
    },
    filter_duration_max() {
      this.handleAppliedFilterChange();
    },
    filter_afk() {
      this.handleAppliedFilterChange();
    },
    filter_merge_similar() {
      this.handleAppliedFilterChange();
    },
    filter_categories() {
      this.handleAppliedFilterChange();
    },
    category_options: {
      immediate: true,
      handler(options, previousOptions) {
        if (options.length === 0) return;

        const previousAllSelected =
          this.category_filter_initialized &&
          previousOptions &&
          previousOptions.length > 0 &&
          this.filter_categories.length === previousOptions.length &&
          previousOptions.every(category => this.isCategorySelected(category.value));

        if (!this.category_filter_initialized || previousAllSelected) {
          this.filter_categories = options.map(category => category.value);
          this.category_filter_initialized = true;
          return;
        }

        this.filter_categories = this.filter_categories.filter(selectedCategory =>
          options.some(category => _.isEqual(category.value, selectedCategory))
        );
      },
    },
    swimlane() {
      this.updateTimelineWindow = false;
      this.scheduleBucketsRefresh();
    },
  },
  mounted() {
    const categoryStore = useCategoryStore();
    // Timeline can be opened directly, before another view has initialized
    // the category store. Avoid reloading it when it already has state, since
    // that could overwrite in-memory category edits from another view.
    if (categoryStore.category_sets.length === 0 && categoryStore.classes.length === 0) {
      categoryStore.load();
    }
  },
  methods: {
    onFiltersToggle(event) {
      if (event.target.open) {
        this.syncFilterDrafts();
      }
    },
    syncFilterDrafts() {
      this.duration_range_error_visible = false;
      this.pending_filter_hostnames = [...this.filter_hostnames];
      this.pending_filter_clients = [...this.filter_clients];
      this.pending_filter_duration_min_unit = this.filter_duration_min_unit;
      this.pending_filter_duration_max_unit = this.filter_duration_max_unit;
      this.pending_filter_duration_min = this.durationInUnit(
        this.filter_duration_min,
        this.filter_duration_min_unit
      );
      this.pending_filter_duration_max = this.durationInUnit(
        this.filter_duration_max,
        this.filter_duration_max_unit
      );
      this.pending_filter_afk = this.filter_afk;
      this.pending_filter_merge_similar = this.filter_merge_similar;
      this.pending_filter_categories = this.filter_categories.map(category => [...category]);
    },
    applyFilterChanges() {
      this.duration_range_error_visible = false;
      if (this.duration_range_invalid) {
        this.duration_range_error_visible = true;
        return;
      }

      if (!_.isEqual(this.filter_hostnames, this.pending_filter_hostnames)) {
        this.filter_hostnames = [...this.pending_filter_hostnames];
      }
      if (!_.isEqual(this.filter_clients, this.pending_filter_clients)) {
        this.filter_clients = [...this.pending_filter_clients];
      }
      const pendingDurationMin = this.normalizeDuration(
        this.pending_filter_duration_min,
        this.pending_filter_duration_min_unit
      );
      const pendingDurationMax = this.normalizeDuration(
        this.pending_filter_duration_max,
        this.pending_filter_duration_max_unit
      );
      if (this.filter_duration_min !== pendingDurationMin) {
        this.filter_duration_min = pendingDurationMin;
      }
      if (this.filter_duration_max !== pendingDurationMax) {
        this.filter_duration_max = pendingDurationMax;
      }
      this.filter_duration_min_unit = this.pending_filter_duration_min_unit;
      this.filter_duration_max_unit = this.pending_filter_duration_max_unit;
      if (this.filter_afk !== this.pending_filter_afk) {
        this.filter_afk = this.pending_filter_afk;
      }
      if (this.filter_merge_similar !== this.pending_filter_merge_similar) {
        this.filter_merge_similar = this.pending_filter_merge_similar;
      }
      if (!_.isEqual(this.filter_categories, this.pending_filter_categories)) {
        this.filter_categories = this.pending_filter_categories.map(category => [...category]);
      }
      this.$refs.filtersDetails.open = false;
    },
    resetFilterChanges() {
      this.pending_filter_hostnames = [...this.hosts];
      this.pending_filter_clients = [...this.clients];
      this.pending_filter_duration_min = null;
      this.pending_filter_duration_max = null;
      this.pending_filter_duration_min_unit = 'seconds';
      this.pending_filter_duration_max_unit = 'seconds';
      this.pending_filter_afk = false;
      this.pending_filter_merge_similar = false;
      this.pending_filter_categories = this.category_options.map(category => [...category.value]);
      this.duration_range_error_visible = false;
    },
    cancelFilterChanges() {
      this.syncFilterDrafts();
      this.$refs.filtersDetails.open = false;
    },
    clearDurationRangeError() {
      this.duration_range_error_visible = false;
    },
    handleAppliedFilterChange() {
      // Initial filter population must not replace the queried time window.
      if (this.is_initial_timeline_load) return;

      this.updateTimelineWindow = false;
      this.scheduleBucketsRefresh();
    },
    scheduleBucketsRefresh() {
      if (this.buckets_refresh_scheduled) return;

      this.buckets_refresh_scheduled = true;
      this.$nextTick(() => {
        this.buckets_refresh_scheduled = false;
        this.getBuckets();
      });
    },
    durationUnitFactor(unit) {
      return { seconds: 1, minutes: 60, hours: 60 * 60 }[unit] || 1;
    },
    durationInUnit(seconds, unit) {
      if (seconds === null || seconds === undefined) return null;
      return seconds / this.durationUnitFactor(unit);
    },
    normalizeDuration(value, unit) {
      if (value === '' || value === null || value === undefined) return null;
      const duration = Number(value) * this.durationUnitFactor(unit);
      return Number.isFinite(duration) && duration >= 0 ? duration : null;
    },
    toggleAllPendingHosts() {
      this.pending_filter_hostnames = this.all_pending_hosts_selected ? [] : [...this.hosts];
    },
    toggleAllPendingClients() {
      this.pending_filter_clients = this.all_pending_clients_selected ? [] : [...this.clients];
    },
    isCategorySelected(category) {
      return this.filter_categories.some(filterCategory => _.isEqual(filterCategory, category));
    },
    isPendingCategorySelected(category) {
      return this.pending_filter_categories.some(filterCategory =>
        _.isEqual(filterCategory, category)
      );
    },
    toggleAllPendingCategories() {
      this.pending_filter_categories = this.all_pending_categories_selected
        ? []
        : this.category_options.map(category => category.value);
    },
    togglePendingCategory(category) {
      if (this.isPendingCategorySelected(category)) {
        this.pending_filter_categories = this.pending_filter_categories.filter(
          filterCategory => !_.isEqual(filterCategory, category)
        );
      } else {
        this.pending_filter_categories = [...this.pending_filter_categories, category];
      }
    },
    getBuckets: async function () {
      if (this.daterange == null) return;

      const completeInitialTimelineLoad = () => {
        if (this.is_initial_timeline_load) {
          // Re-enable filter-driven refreshes after the first chart update.
          this.$nextTick(() => {
            this.is_initial_timeline_load = false;
          });
        }
      };

      this.all_buckets = Object.freeze(
        await useBucketsStore().getBucketsWithEvents({
          start: this.daterange[0].format(),
          end: this.daterange[1].format(),
        })
      );

      const previousAllHostsSelected =
        this.host_filter_initialized &&
        this.hosts.length > 0 &&
        this.filter_hostnames.length === this.hosts.length &&
        this.hosts.every(host => this.filter_hostnames.includes(host));
      const previousAllClientsSelected =
        this.client_filter_initialized &&
        this.clients.length > 0 &&
        this.filter_clients.length === this.clients.length &&
        this.clients.every(client => this.filter_clients.includes(client));

      this.hosts = this.all_buckets
        .map(a => a.hostname)
        .filter((value, index, array) => array.indexOf(value) === index);
      this.clients = this.all_buckets
        .map(a => a.client)
        .filter((value, index, array) => array.indexOf(value) === index);

      if (this.hosts.length > 0) {
        if (!this.host_filter_initialized || previousAllHostsSelected) {
          const nextHostnames = [...this.hosts];
          if (!_.isEqual(this.filter_hostnames, nextHostnames)) {
            this.filter_hostnames = nextHostnames;
          }
        } else {
          const nextHostnames = this.filter_hostnames.filter(host => this.hosts.includes(host));
          if (!_.isEqual(this.filter_hostnames, nextHostnames)) {
            this.filter_hostnames = nextHostnames;
          }
        }
        this.host_filter_initialized = true;
      } else {
        if (this.filter_hostnames.length > 0) {
          this.filter_hostnames = [];
        }
      }

      if (this.clients.length > 0) {
        if (!this.client_filter_initialized || previousAllClientsSelected) {
          const nextClients = [...this.clients];
          if (!_.isEqual(this.filter_clients, nextClients)) {
            this.filter_clients = nextClients;
          }
        } else {
          const nextClients = this.filter_clients.filter(client => this.clients.includes(client));
          if (!_.isEqual(this.filter_clients, nextClients)) {
            this.filter_clients = nextClients;
          }
        }
        this.client_filter_initialized = true;
      } else {
        if (this.filter_clients.length > 0) {
          this.filter_clients = [];
        }
      }

      let buckets = this.all_buckets;
      if (!this.all_hosts_selected) {
        buckets = _.filter(buckets, b => this.filter_hostnames.includes(b.hostname));
      }
      if (!this.all_clients_selected) {
        buckets = _.filter(buckets, b => this.filter_clients.includes(b.client));
      }

      // An explicitly empty category selection means no events. Return early
      // so later AFK/merge processing cannot repopulate the timeline.
      if (
        this.category_filter_initialized &&
        !this.all_categories_selected &&
        this.filter_categories.length === 0
      ) {
        this.buckets = [];
        completeInitialTimelineLoad();
        return;
      }

      const durationMin = this.filter_duration_min;
      const durationMax = this.filter_duration_max;
      if (durationMin !== null || durationMax !== null) {
        for (const bucket of buckets) {
          bucket.events = _.filter(bucket.events, e => {
            if (durationMin !== null && e.duration < durationMin) return false;
            if (durationMax !== null && e.duration > durationMax) return false;
            return true;
          });
        }
      }

      if (this.category_filter_initialized && !this.all_categories_selected) {
        const categoryStore = useCategoryStore();
        const allCats = categoryStore.classes;
        for (const bucket of buckets) {
          if (this.filter_categories.length === 0) {
            bucket.events = [];
            continue;
          }
          // Skip AFK buckets — they don't have meaningful categorization
          if (bucket.type === 'afkstatus') continue;
          bucket.events = _.filter(bucket.events, e => {
            const str = getCategorizationStringFromEvent(bucket, e);
            if (str === null) return true; // Keep events from unknown bucket types
            const matched = matchString(str, allCats, e);
            const eventCat = matched ? matched.name : ['Uncategorized'];
            // Check if the event's category matches any selected filter category
            // (including parent matches: selecting "Work" also shows "Work > Programming")
            return this.filter_categories.some(filterCat =>
              _.isEqual(eventCat.slice(0, filterCat.length), filterCat)
            );
          });
        }
      }

      // AFK filtering: use query engine to filter window events by AFK status
      if (this.filter_afk) {
        buckets = await this._applyAfkFilter(buckets);
      }

      // Merge adjacent events by app name for window buckets.
      // Runs after AFK filtering so merges operate on already-filtered events.
      // Reduces visual clutter from apps that produce many small events (e.g.
      // Adobe Illustrator's TAB key toggling UI panels). See: activitywatch#1165
      if (this.filter_merge_similar) {
        buckets = this._applyMergeSimilar(buckets);
      }

      this.buckets = buckets;
      completeInitialTimelineLoad();
    },

    // Merges adjacent events with the same app name within window buckets.
    // This collapses rapid title changes (e.g. toggling UI panels) into single
    // blocks per app, fixing timeline flooding for apps like Adobe Illustrator.
    _applyMergeSimilar: function (buckets) {
      return buckets.map(bucket => {
        if (bucket.type !== 'currentwindow' || !bucket.events || bucket.events.length <= 1) {
          return bucket;
        }

        const sorted = [...bucket.events].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const merged = [];
        let current = { ...sorted[0] };

        for (let i = 1; i < sorted.length; i++) {
          const next = sorted[i];
          const currentEnd = new Date(current.timestamp).getTime() + current.duration * 1000;
          const nextStart = new Date(next.timestamp).getTime();
          const gap = nextStart - currentEnd;

          // Merge if same app and gap is small (< 30 seconds)
          if (current.data?.app && current.data.app === next.data?.app && gap < 30000) {
            const nextEnd = nextStart + next.duration * 1000;
            current.duration =
              (Math.max(currentEnd, nextEnd) - new Date(current.timestamp).getTime()) / 1000;
          } else {
            merged.push(current);
            current = { ...next };
          }
        }
        merged.push(current);

        return { ...bucket, events: merged };
      });
    },

    // Replaces raw window bucket events with AFK-filtered events via aw query engine.
    // Also hides AFK status buckets since they're used for filtering, not display.
    _applyAfkFilter: async function (buckets) {
      const bucketsStore = useBucketsStore();
      const result = [];

      for (const bucket of buckets) {
        // Hide AFK status buckets when AFK filtering is active
        if (bucket.type === 'afkstatus') {
          continue;
        }

        // For window buckets, replace events with AFK-filtered query results
        if (bucket.type === 'currentwindow' && bucket.hostname) {
          const afkBucketIds = bucketsStore.bucketsAFK(bucket.hostname);
          if (afkBucketIds.length > 0) {
            try {
              const filteredEvents = await this._queryAfkFilteredEvents(bucket.id, afkBucketIds[0]);
              // Create a copy with filtered events to avoid mutating frozen all_buckets
              result.push({ ...bucket, events: filteredEvents });
              continue;
            } catch (e) {
              console.warn('AFK filter query failed, falling back to raw events:', e);
            }
          }
        }

        // Keep other buckets unchanged
        result.push(bucket);
      }

      return result;
    },

    // Runs a canonicalEvents query to get window events filtered by AFK status,
    // respecting the user's always_active_pattern setting.
    _queryAfkFilteredEvents: async function (windowBucketId, afkBucketId) {
      const queryCode =
        canonicalEvents({
          bid_window: windowBucketId,
          bid_afk: afkBucketId,
          filter_afk: true,
          always_active_pattern: this.always_active_pattern || undefined,
          categories: [],
          filter_categories: null,
        }) + '\nRETURN = events;';

      const queryArray = querystr_to_array(queryCode);

      const start = this.daterange[0].format();
      const end = this.daterange[1].format();
      const timeperiods = [`${start}/${end}`];

      const data = await getClient().query(timeperiods, queryArray);
      return data[0] || [];
    },
  },
};
</script>

<style scoped>
.timeline-toolbar {
  row-gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.timeline-chip {
  display: inline-flex;
  align-items: center;
  border: 1px solid #dee2e6;
  border-radius: 0.25rem;
  background: #fff;
  padding: 0.375rem 0.625rem;
  font-size: 0.875rem;
  line-height: 1.25;
}

.timeline-chip--clickable {
  cursor: pointer;
  user-select: none;
}

.timeline-chip--clickable:hover {
  background: #f8f9fa;
}

.timeline-filters {
  position: relative;
}

.timeline-filters > summary {
  list-style: none;
}

.timeline-filters > summary::-webkit-details-marker {
  display: none;
}

.timeline-filters-panel {
  display: none;
  position: absolute;
  left: 0;
  top: calc(100% + 4px);
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  padding: 0.75rem 1rem 1rem;
  z-index: 100;
  width: min(36rem, calc(100vw - 2rem));
  max-width: calc(100vw - 2rem);
  height: 44rem;
  box-sizing: border-box;
  overflow: hidden;
}

.timeline-filters[open] .timeline-filters-panel {
  display: block;
}

.timeline-filter-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e9ecef;
}

.timeline-filter-reset {
  margin-right: 1rem;
}

.timeline-duration-inputs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.timeline-duration-control {
  min-width: 0;
}

.timeline-duration-field {
  display: flex;
  min-width: 0;
  flex: 1 1 0;
}

.timeline-duration-field input {
  width: 0;
  min-width: 0;
  flex: 1 1 0;
}

.timeline-duration-field select {
  width: 6.5rem;
  flex: 0 0 6.5rem;
  margin-left: 0.25rem;
}

.timeline-duration-separator {
  flex: 0 0 auto;
  color: #6c757d;
}

.timeline-duration-error {
  display: block;
  margin-top: 0.25rem;
}

.timeline-filter-toggles {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.timeline-filter-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  cursor: pointer;
}

.timeline-filter-toggle input {
  margin: 0;
}

.timeline-filters-panel table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}

.timeline-filters-panel th {
  width: 7rem;
  vertical-align: top;
}

.timeline-filters-panel th,
.timeline-filters-panel td {
  padding-top: 0;
  padding-bottom: 0.75rem;
  min-width: 0;
  vertical-align: top;
}

.timeline-filters-panel tr + tr > th,
.timeline-filters-panel tr + tr > td {
  padding-top: 0.75rem;
  border-top: 1px solid #e9ecef;
}

.timeline-filters-panel tr:last-child > th,
.timeline-filters-panel tr:last-child > td {
  padding-bottom: 0;
}

.timeline-filter-options {
  max-height: 9rem;
  width: 100%;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
}

.timeline-filters-panel tr:last-child .timeline-filter-options {
  max-height: 12rem;
}

.timeline-filter-option {
  display: flex;
  align-items: flex-start;
  width: 100%;
  min-width: 0;
  margin-bottom: 0.25rem;
  white-space: normal;
  cursor: pointer;
}

.timeline-filter-option input {
  flex: 0 0 auto;
  margin-right: 0.35rem;
  margin-top: 0.2rem;
}

.timeline-filter-option-label {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
