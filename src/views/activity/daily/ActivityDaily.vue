<template lang="pug">
div
  h2 Daily Activity for {{ date | shortdate }}

  p
    | Host: {{ host }}
    br
    | Active time: {{ $store.state.activity_daily.active_duration | friendlyduration }}

  div.d-flex
    div.p-1
      b-button-group
        b-button(:to="link_prefix + '/' + previousDay() + '/summary'", variant="outline-dark")
          icon(name="arrow-left")
          span.d-none.d-md-inline
            |  Previous day
        b-button(:to="link_prefix + '/' + nextDay() + '/summary'", :disabled="nextDay() > today", variant="outline-dark")
          span.d-none.d-md-inline
            |  Next day
          icon(name="arrow-right")
    div.p-1
      input.form-control(id="date" type="date" :value="date" :max="today" @change="setDate($event.target.value)")

    div.p-1.ml-auto
      b-button-group
        b-button(@click="refresh(true)", variant="outline-dark")
          icon(name="sync")
          span.d-none.d-md-inline
            |  Refresh

  aw-periodusage(:periodusage_arr="$store.state.activity_daily.active_history", :link_prefix="link_prefix")

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
import { get_day_period } from "~/util/time.js";

import 'vue-awesome/icons/arrow-left'
import 'vue-awesome/icons/arrow-right'
import 'vue-awesome/icons/angle-double-down'
import 'vue-awesome/icons/sync'

import queries from '~/queries.js';

const get_today = () => moment().startOf('day').format("YYYY-MM-DD");

export default {
  name: "Activity",
  props: {
    host: String,
    date: {
      type: String,
      default: get_today(),
    }
  },
  data: function() {
    return {
      today: get_today(),
    }
  },
  watch: {
    date: function() {
      this.refresh();
    },
  },

  computed: {
    date: function() { return this.$route.params.date || moment().format("YYYY-MM-DD") },
    link_prefix: function() { return "/activity/daily/"   + this.host },
  },

  mounted: async function() {
    await this.refresh();
  },

  methods: {
    previousDay: function() { return moment(this.date).subtract(1, 'days').format("YYYY-MM-DD") },
    nextDay: function() { return moment(this.date).add(1, 'days').format("YYYY-MM-DD") },
    setDate: function(date) { this.$router.push('/activity/daily/' + this.host + '/' + date); },

    refresh: async function(force) {
      await this.$store.dispatch("activity_daily/ensure_loaded", Object.assign(this.$route.params, { force: force, filterAFK: true }));
    },
  },
}
</script>
