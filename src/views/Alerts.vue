<template lang="pug">
div
  h3 Alerts

  // TODO: Call this "goals" instead? (alerts is more general, but goals might fit the most common use better
  // TODO: Support 'less than' goals
  // TODO: Send notifications when goals met
  // TODO: Query from day start, not 24h ago

  b-alert(variant="warning" :model-value="true")
    | This feature is still in early development.

  b-alert(v-if="error" :model-value="true" variant="danger")
    | {{error}}

  b-alert(v-if="hostnames.length === 0" :model-value="true" variant="info")
    | No host with both window and AFK buckets is available, so alerts can't run yet.
    | Install #[a(href="https://docs.activitywatch.net/en/latest/watchers.html") aw-watcher-window and aw-watcher-afk] to enable this view.

  b-card(v-for="alert in alerts", :key="alert.name")
    b-button.float-end(@click="deleteAlert(alert.name)" size="sm" variant="outline-danger")
      icon(name="trash")

    div Goal name: {{ alert.name }}
    div Category: {{ alert.category.join(" > ") }}
    div Current: {{ friendlyduration(alertTime(alert.category)) }} / {{alert.goal}} minutes
      span(v-if="alertTime(alert.category) >= alert.goal")
        icon.text-success(name="check")
      span(v-else)
        icon.text-muted(name="times")

  div.d-flex.align-items-center.mt-3
    b-button(@click="check" variant="success" :disabled="!hostname") Check
    b-form-checkbox.ms-3.mb-0(v-model="autorefresh", @update:model-value="toggleAutoRefresh", switch) Auto-refresh every 10s

  small.text-muted(v-if="last_updated")
    | Last updated #[time(:datetime="last_updated && last_updated.toISOString && last_updated.toISOString()") {{ friendlytime(last_updated) }}]

  hr

  div
    h4 New alert
    b-form-group(label="Name" label-cols-md=2)
      b-form-input(v-model="editing_alert.name")
    b-form-group(label="Category" label-cols-md=2)
      b-form-select(v-model="editing_alert.category")
        option(v-for="category in categories" :value="category.value") {{ category.text }}
    b-form-group(label="Goal" label-cols-md=2)
      b-input-group(append="minutes")
        b-form-input(v-model="editing_alert.goal" type="number")

    div
      b-button(@click="addAlert" variant="success")
        icon(name="plus")
        | Add alert
</template>

<style scoped lang="scss"></style>

<script lang="ts">
import _ from 'lodash';
import moment from 'moment';
import { canonicalEvents, querystr_to_array } from '~/queries';

import { useBucketsStore } from '~/stores/buckets';
import { useCategoryStore } from '~/stores/categories';

export default {
  name: 'Alerts',
  data() {
    return {
      bucketsStore: useBucketsStore(),
      categoryStore: useCategoryStore(),

      // TODO: Support negative goals (avoid distractions)
      alerts: [
        { name: 'Work', category: ['Work'], goal: 100 },
        { name: 'Media', category: ['Media'], goal: 10 },
      ],
      editing_alert: {},

      alert_times: {},

      error: '',

      hostnames: [],
      hostname: '',

      last_updated: null,

      autorefresh: false,
      running_interval: null,

      // Options
      show_options: false,
      use_regex: true,
      filter_afk: true,
    };
  },
  computed: {
    categories: function () {
      return this.categoryStore.category_select(true);
    },
    alertTime: function () {
      return cat => {
        let time = 0;
        _.map(Object.entries(this.alert_times), ([c, t]) => {
          if (c.startsWith(cat.join(','))) {
            if (typeof t === 'number') time += t;
          }
        });
        return time;
      };
    },
  },
  mounted: async function () {
    await this.bucketsStore.ensureLoaded();
    await this.categoryStore.load();
    // Filter to hosts that actually have the buckets we query against.
    // Prevents "There's no bucket named 'aw-watcher-afk_<host>'" when the
    // hosts list contains a stale hostname with only one orphan bucket.
    this.hostnames = this.bucketsStore.hosts.filter(
      h =>
        this.bucketsStore.bucketsWindow(h).length > 0 && this.bucketsStore.bucketsAFK(h).length > 0
    );
    this.hostname = this.hostnames[0];
  },
  methods: {
    addAlert: function () {
      // TODO: Persist to settings/localstorage
      this.alerts = this.alerts.concat({ ...this.editing_alert });
    },
    deleteAlert: function (name) {
      this.alerts = this.alerts.filter(a => a.name !== name);
    },

    toggleAutoRefresh: function () {
      if (!this.autorefresh || this.running_interval) {
        console.log('Stopping autorefresh');
        clearInterval(this.running_interval);
        this.autorefresh = false;
        this.running_interval = null;
      } else {
        console.log('Starting autorefresh');
        this.autorefresh = true;
        this.running_interval = setInterval(this.check, 10000);
      }
    },

    // Check current time of alert goals
    check: async function () {
      let query = canonicalEvents({
        ...this.bucketsStore.desktopBucketIds(this.hostname),
        filter_afk: this.filter_afk,
        categories: useCategoryStore().classes_for_query,
        filter_categories: null, // classes.map(c => c[0]),
      });
      query += '; RETURN = events;';

      const query_array = querystr_to_array(query);

      // Get start of today
      const start = moment().subtract(1, 'days').startOf('day');
      const end = moment(start).add(1, 'days');
      const timeperiods = [start.format() + '/' + end.format()];

      try {
        this.status = 'searching';
        const data = await this.$aw.query(timeperiods, query_array);
        this.events = data[0];
        this.error = '';
      } catch (e) {
        console.error(e);
        this.error = e.response.data.message;
        return;
      } finally {
        this.status = null;
      }

      const grouped = _.groupBy(this.events, e => e.data.$category);
      const sumCats = Object.fromEntries(
        _.map(Object.entries(grouped), entry => {
          const [group, events] = entry;
          return [group.split(','), _.sumBy(events, 'duration')];
        })
      );
      this.alert_times = sumCats;

      this.last_updated = new Date();
    },
  },
};
</script>
