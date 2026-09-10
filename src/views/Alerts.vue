<template lang="pug">
div
  h3 Alerts

  // TODO: Call this "goals" instead? (alerts is more general, but goals might fit the most common use better
  // TODO: Support 'less than' goals
  // TODO: Send notifications when goals met

  b-alert(variant="warning" show)
    | This feature is still in early development.

  b-alert(v-if="error" show variant="danger")
    | {{error}}

  b-alert(v-if="hostnames.length === 0" show variant="info")
    | No host with both window and AFK buckets is available, so alerts can't run yet.
    | Install #[a(href="https://docs.activitywatch.net/en/latest/watchers.html") aw-watcher-window and aw-watcher-afk] to enable this view.

  b-card(v-for="alert in alerts", :key="alert.name")
    b-button.float-right(@click="deleteAlert(alert.name)" size="sm" variant="outline-danger" :disabled="saving")
      icon(name="trash")

    div Goal name: {{ alert.name }}
    div Category: {{ alert.category.join(" > ") }}
    div Current: {{ alertTime(alert.category) | friendlyduration }} / {{alert.goal}} minutes
      span(v-if="alertTime(alert.category) >= alert.goal")
        icon.text-success(name="check")
      span(v-else)
        icon.text-muted(name="times")

  div.d-flex.align-items-center.mt-3
    b-btn(@click="check" variant="success" :disabled="!hostname") Check
    b-form-checkbox.ml-3.mb-0(v-model="autorefresh", @change="toggleAutoRefresh", switch) Auto-refresh every 10s

  small.text-muted(v-if="last_updated")
    | Last updated #[time(:datetime="last_updated && last_updated.toISOString && last_updated.toISOString()") {{ last_updated | friendlytime }}]

  hr

  div
    h4 New alert
    b-form-group(label="Name" label-cols-md=2)
      b-input(v-model="editing_alert.name")
    b-form-group(label="Category" label-cols-md=2)
      b-select(v-model="editing_alert.category")
        option(v-for="category in categories" :value="category.value") {{ category.text }}
    b-form-group(label="Goal" label-cols-md=2)
      b-input-group(append="minutes")
        b-input(v-model="editing_alert.goal" type="number")

    div
      b-btn(@click="addAlert" variant="success" :disabled="saving")
        icon(name="plus")
        | Add alert
</template>

<style scoped lang="scss"></style>

<script lang="ts">
import _ from 'lodash';
import moment from 'moment';
import { canonicalEvents, querystr_to_array } from '~/queries';

import 'vue-awesome/icons/plus';
import 'vue-awesome/icons/check';
import 'vue-awesome/icons/times';
import 'vue-awesome/icons/trash';

import { useBucketsStore } from '~/stores/buckets';
import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';
import { get_day_start_with_offset, get_offset_duration } from '~/util/time';
import { cleanAlertGoal, cleanAlertGoals, getDefaultAlertGoals } from '~/util/alerts';

export default {
  name: 'Alerts',
  data() {
    return {
      bucketsStore: useBucketsStore(),
      categoryStore: useCategoryStore(),
      settingsStore: useSettingsStore(),

      // TODO: Support negative goals (avoid distractions)
      // Loaded from settings in mounted(); sample goals are seeded there only
      // when nothing has been stored yet.
      alerts: [],
      editing_alert: {},

      // Set while an add/delete is being persisted, to block duplicate writes.
      saving: false,

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
    await this.settingsStore.ensureLoaded();
    // A stored empty list is a deliberate "no goals" and must be preserved;
    // only a first run (nothing ever stored) gets the sample goals.
    this.alerts = this.settingsStore.hasStoredAlerts
      ? cleanAlertGoals(this.settingsStore.alerts)
      : getDefaultAlertGoals();
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
    addAlert: async function () {
      const goal = cleanAlertGoal(this.editing_alert);
      if (goal === null) {
        this.error = 'A goal needs a name, a category, and a positive number of minutes.';
        return;
      }
      if (await this.persistAlerts(this.alerts.concat(goal))) {
        this.editing_alert = {};
      }
    },
    deleteAlert: async function (name) {
      await this.persistAlerts(this.alerts.filter(a => a.name !== name));
    },

    // Save the given goals, keeping the shown list and storage in step. Returns
    // whether the write succeeded; on failure the previous list is restored so
    // the view never implies a failed write was durable.
    persistAlerts: async function (alerts) {
      if (this.saving) return false;
      const previous = this.alerts;
      this.saving = true;
      this.alerts = alerts;
      try {
        await this.settingsStore.update({ alerts });
        this.error = '';
        return true;
      } catch (e) {
        console.error(e);
        this.alerts = previous;
        this.error = 'Failed to save alert goals. Please try again.';
        return false;
      } finally {
        this.saving = false;
      }
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
        bid_window: 'aw-watcher-window_' + this.hostname,
        bid_afk: 'aw-watcher-afk_' + this.hostname,
        filter_afk: this.filter_afk,
        categories: useCategoryStore().classes_for_query,
        filter_categories: null, // classes.map(c => c[0]),
      });
      query += '; RETURN = events;';

      const query_array = querystr_to_array(query);

      // Query from the start of the current activity day through now. The
      // activity day respects the user's startOfDay setting (default 04:00),
      // so before that boundary we are still on the previous calendar day.
      // `now` is captured once so the interval stays consistent even if the
      // query straddles the boundary.
      const now = moment();
      const activity_day = moment(now).subtract(get_offset_duration()).startOf('day');
      const start = moment(get_day_start_with_offset(activity_day));
      const timeperiods = [start.format() + '/' + now.format()];

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
