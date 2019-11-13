<template lang="pug">
div
  h2 Activity for {{ periodReadable }}

  p
    | Host: {{ host }}
    br
    | Active time: {{ $store.state.activity_daily.active_duration | friendlyduration }}

  div.d-flex
    div.p-1
      b-button-group
        b-button(:to="link_prefix + '/' + previousPeriod()", variant="outline-dark")
          icon(name="arrow-left")
          span.d-none.d-md-inline
            |  Previous
        b-button(:to="link_prefix + '/' + nextPeriod()", :disabled="nextPeriod() > today", variant="outline-dark")
          span.d-none.d-md-inline
            |  Next
          icon(name="arrow-right")
    div.p-1
      b-select(:value="periodLength", :options="['day', 'week', 'month']", @change="(periodLength) => setDate(date, periodLength)")
    div.p-1(v-if="periodLength === 'day'")
      input.form-control(id="date" type="date" :value="date" :max="today" @change="setDate($event.target.value)")

    div.p-1.ml-auto
      b-button-group
        b-button(@click="refresh(true)", variant="outline-dark")
          icon(name="sync")
          span.d-none.d-md-inline
            |  Refresh

  aw-periodusage(:periodusage_arr="periodusage", :link_prefix="link_prefix")

  ul.row.nav.nav-tabs.my-3.px-3
    li.nav-item
      router-link.nav-link(:to="{ name: 'activity-daily-summary', params: $route.params }")
        h5 Summary
    li.nav-item
      router-link.nav-link(:to="{ name: 'activity-daily-window', params: $route.params }")
        h5 Window
    li.nav-item
      router-link.nav-link(:to="{ name: 'activity-daily-browser', params: $route.params }")
        h5 Browser
    li.nav-item
      router-link.nav-link(:to="{ name: 'activity-daily-editor', params: $route.params }")
        h5 Editor

  div
    router-view
</template>

<style lang="scss" scoped>
.nav {
  border-bottom: 2px solid #eee;

  .nav-item {
    margin-bottom: -2px;

    .nav-link {
      background-color: #eee;
      border: 2px solid #eee;
      border-bottom: none;
      margin: 0 0.2em 0 0.2em;
      border-radius: 0.5rem 0.5rem 0 0;

      &:hover {
        background-color: #f8f8f8;
      }

      &.router-link-exact-active {
        background-color: #fff;

        &:hover {
          background-color: #fff;
        }
      }
    }
  }
}
</style>

<script>
import moment from 'moment';
import { get_day_start_with_offset } from '~/util/time';

import 'vue-awesome/icons/arrow-left'
import 'vue-awesome/icons/arrow-right'
import 'vue-awesome/icons/sync'

const get_today = () => moment().startOf('day').format("YYYY-MM-DD");

export default {
  name: "Activity",
  props: {
    host: String,
    date: {
      type: String,
      default: get_today(),
    },
    periodLength: {
      type: String,
      default: 'day',
    },
  },
  data: function() {
    return {
      today: get_today(),
    };
  },
  computed: {
    link_prefix: function() { return `/activity/${this.host}/${this.periodLength}` },
    periodusage: function() {
      return this.$store.getters['activity_daily/getActiveHistoryAroundTimeperiod'](this.timeperiod);
    },
    timeperiod: function() {
      // TODO: Get start of day/week/month (depending on periodLength) with offset
      return { start: get_day_start_with_offset(this.date), length: [1, this.periodLength] };
    },
    dateformat: function() {
      if(this.periodLength === 'day') { return "YYYY-MM-DD"; }
      else if(this.periodLength === 'week') { return "YYYY[ W]WW"; }
      else if(this.periodLength === 'month') { return "YYYY-MM"; }
      else if(this.periodLength === 'year') { return "YYYY"; }
      else {
        return "YYYY-MM-DD";
      }
    },
    periodReadable: function() { return moment(this.timeperiod.start).format(this.dateformat); },
  },
  watch: {
    timeperiod: function() {
      this.refresh();
    },
  },

  mounted: async function() {
    await this.refresh();
  },

  methods: {
    previousPeriod: function() { return moment(this.date).subtract(1, `${this.periodLength}s`).format("YYYY-MM-DD") },
    nextPeriod: function() { return moment(this.date).add(1, `${this.periodLength}s`).format("YYYY-MM-DD") },
    setDate: function(date, periodLength) {
      const new_date = moment(date).startOf(periodLength).format("YYYY-MM-DD");
      this.$router.push(`/activity/${this.host}/${periodLength}/${new_date}`);
    },

    refresh: async function(force) {
      await this.$store.dispatch("activity_daily/ensure_loaded", { timeperiod: this.timeperiod, host: this.host, force: force, filterAFK: true });
    },
  },
}
</script>
