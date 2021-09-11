<template lang="pug">
div
  h3 Alerts

  // TODO: Call this "goals" instead? (alerts is more general, but goals might fit the most common use better
  // TODO: Support 'less than' goals
  // TODO: Send notifications when goals met
  // TODO: Query from day start, not 24h ago

  b-alert(style="warning" show)
    | This feature is still in early development.

  b-alert(v-if="error" show variant="danger")
    | {{error}}

  b-card(v-for="alert in alerts")
    div Name: {{ alert.name }}
    div Category: {{ alert.category.join(" > ") }}
    div Current: {{ alertTime(alert.category) | friendlyduration }} / {{alert.goal}} minutes
      span(v-if="alertTime(alert.category) >= alert.goal")
        icon(name="check" style="color: #0C0")
      span(v-else)
        icon(name="times" color="#555")

  //div
  //  | {{alert_times}}

  div
    b-btn(@click="check") Check
    small
      b-form-checkbox(v-model="autorefresh", @change="toggleAutoRefresh", switch) Toggle autorefresh every 10s

  small(v-if="last_updated")
    | Last updated: {{ last_updated }}

  hr

  div
    h4 New alert
    | Name:
    b-input(v-model="editing_alert.name")
    | Category:
    b-select(v-model="editing_alert.category")
      option(v-for="category in categories" :value="category.value") {{ category.text }}
    | Goal:
    input(v-model="editing_alert.goal")
    | minutes

    div
      b-btn(@click="addAlert")
        icon(name="plus")
        | Add alert
</template>

<style scoped lang="scss"></style>

<script>
import _ from 'lodash';
import moment from 'moment';
import { canonicalEvents } from '~/queries';
import { loadClassesForQuery } from '~/util/classes';

import 'vue-awesome/icons/plus';
import 'vue-awesome/icons/check';
import 'vue-awesome/icons/times';

export default {
  name: 'Alerts',
  data() {
    return {
      alerts: [{ name: 'Test', category: ['Work'], goal: 100 }],
      editing_alert: {},

      alert_times: {},

      error: '',

      hostnames: [],
      hostname: 'erb-main2-arch',

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
      return this.$store.getters['categories/category_select'](true);
    },
    alertTime: function () {
      return cat => {
        let time = 0;
        _.map(Object.entries(this.alert_times), ([c, t]) => {
          if (c.startsWith(cat.join(','))) {
            time += t;
          }
        });
        return time;
      };
    },
  },
  mounted: async function () {
    await this.$store.dispatch('buckets/ensureBuckets');
    await this.$store.dispatch('categories/load');
    this.hostnames = this.$store.getters['buckets/getHostnames'];
  },
  methods: {
    addAlert: function () {
      const new_alert = this.editing_alert;
      this.alerts = this.alerts.concat(new_alert);
      // TODO: Persist to settings/localstorage
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
      /*
      const test_class = [['test', 'alert'], { type: 'regex', regex: 'aw-' }];
      // TODO: Add alert classes
      console.log(this.alerts);
      const cats = _.map(this.alerts, a => {
        const cat = this.$store.getters['categories/get_category'](a.category);
        return [cat.name, cat.rule];
      });
      */
      const start = moment().subtract(1, 'day');
      const stop = moment().add(1, 'day');

      const classes = loadClassesForQuery();

      let query = canonicalEvents({
        bid_window: 'aw-watcher-window_' + this.hostname,
        bid_afk: 'aw-watcher-afk_' + this.hostname,
        filter_afk: this.filter_afk,
        classes: classes,
        filter_classes: null, // classes.map(c => c[0]),
      });
      query += '; RETURN = events;';

      const query_array = query.split(';').map(s => s.trim() + ';');
      const timeperiods = [start.format() + '/' + stop.format()];
      try {
        this.status = 'searching';
        const data = await this.$aw.query(timeperiods, query_array);
        console.log(data);
        this.events = data[0];
        this.error = '';
      } catch (e) {
        console.error(e);
        this.error = e.response.data.message;
        return;
      } finally {
        this.status = null;
      }

      let grouped = _.groupBy(this.events, e => e.data.$category);
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
