<template lang="pug">
div
  h2 Activity for {{ dateShort }}

  p
    | Device type: Android
    br
    | Host: {{ host }}
    br
    | Active time: {{ total_duration | friendlyduration }}

  div.d-flex
    div.p-1
      b-button-group
        b-button(:to="'/activity/android/' + host + '/' + previousDay()", variant="outline-dark")
          icon(name="arrow-left")
          span.d-none.d-lg-inline
            |  Previous day
        b-button(:to="'/activity/android/' + host + '/' + nextDay()", :disabled="nextDay() > today", variant="outline-dark")
          span.d-none.d-lg-inline
            |  Next day
          icon(name="arrow-right")
    div.p-1
      input.form-control(id="date" type="date" :value="dateShort" :max="today" @change="setDate($event.target.value)")

    div.p-1.ml-auto
      b-button-group
        b-button(@click="refresh()", variant="outline-dark")
          icon(name="sync")
          span.d-none.d-lg-inline
            |  Refresh

  aw-periodusage(:periodusage_arr="daily_activity", :host="host")

  br

  div.row
    div.col-md-4
      h5 Top Applications
      aw-summary(:fields="top_apps", :namefunc="top_apps_namefunc", :colorfunc="top_apps_colorfunc")
      b-button(size="sm", variant="outline-secondary", :disabled="top_apps.length < top_apps_count", @click="top_apps_count += 5; queryApps()")
        icon(name="angle-double-down")
        | Show more


</template>

<style lang="scss">
</style>

<script>
import moment from 'moment';
import _ from 'lodash';
import 'vue-awesome/icons/arrow-left'
import 'vue-awesome/icons/arrow-right'
import 'vue-awesome/icons/angle-double-down'
import 'vue-awesome/icons/sync'

import query from '~/queries';
import { get_day_period } from "~/util/time";


export default {
  name: "Activity",
  data: () => {
    return {
      today: moment().startOf('day').format("YYYY-MM-DD"),

      // Query variables
      total_duration: "",

      daily_activity: [],

      top_apps: [],
      top_apps_count: 5,
      top_apps_namefunc: (e) => e.data.app,
      top_apps_colorfunc: (e) => e.data.app,

      appBucketId: "aw-watcher-android-test",
    }
  },

  computed: {
    dateShort: function() { return moment(this.date).format("YYYY-MM-DD") },
  },
  watch: {
    '$route': function() {
      this.refresh();
    },
  },

  mounted: function() {
    this.refresh();
    this.testError();
  },

  methods: {
    previousDay: function() { return moment(this.dateStart).subtract(1, 'days').format("YYYY-MM-DD") },
    nextDay: function() { return moment(this.dateStart).add(1, 'days').format("YYYY-MM-DD") },
    setDate: function(date) { this.$router.push('/activity/android/' + this.host + '/' + date); },

    refresh: function() {
      this.queryAll();
    },

    queryAll: function() {
      this.total_duration = 0;
      this.eventcount = 0;

      this.queryApps();
      this.queryDailyActivity();
    },

    queryApps: async function() {
      const periods = [get_day_period(this.date)];
      const q = query.appQuery(this.appBucketId, this.top_apps_count);
      let data = await this.$aw.query(periods, q).catch(this.errorHandler);
      data = data[0];
      this.top_apps = data["events"];
      this.total_duration = data["total_duration"];
    },

    queryDailyActivity: async function() {
      const timeperiods = [];
      for (let i=-15; i<=15; i++) {
        timeperiods.push(get_day_period(moment(this.date).add(i, 'days')));
      }
      const dur_per_date = await this.$aw.query(timeperiods, query.dailyActivityQueryAndroid(this.appBucketId)).catch(this.errorHandler);
      // TODO: This is some nasty shit, aw-periodusage should really just accept an array with (timestamp, duration) tuples instead.
      this.daily_activity = _.map(_.zip(timeperiods, dur_per_date), (t) => {
        const timestamp = t[0].split("/")[0];
        const duration = t[1];
        return [
          {
            "timestamp": timestamp,
            "duration": duration,
            "data": {
              "status": "not-afk"
            }
          }
        ]
      })
      console.log(this.daily_activity);
    },

    testError() {
      //throw 'error: some message';
    }
  },
}
</script>
