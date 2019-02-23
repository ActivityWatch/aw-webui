<template lang="pug">
div
  h2 Activity for {{ dateShort }}

  p
    | Device type: Android
    br
    | Host: {{ host }}
    br
    | Active time: {{ readableDuration }}

  b-alert(variant="danger" :show="errormsg.length > 0")
    | {{ errormsg }}

  div.d-flex
    div.p-1
      b-button-group
        b-button(:to="'/activity/' + host + '/' + previousDay()", variant="outline-dark")
          icon(name="arrow-left")
          |  Previous day
        b-button(:to="'/activity/' + host + '/' + nextDay()", :disabled="nextDay() > today", variant="outline-dark")
          |  Next day
          icon(name="arrow-right")
    div.p-1
      input.form-control(id="date" type="date" :value="dateShort" :max="today" @change="setDate($event.target.value)")

    div.p-1.ml-auto
      b-button-group
        b-button(@click="refresh()", variant="outline-dark")
          icon(name="sync")
          |  Refresh

  aw-periodusage(:periodusage_arr="daily_activity", :host="host")

  br

  div.row
    div.col-md-4
      h5 Top Applications
      aw-summary(:fields="top_apps", :namefunc="top_apps_namefunc", :colorfunc="top_apps_colorfunc")
      b-button(size="sm", variant="outline-secondary", :disabled="top_apps.length < top_apps_count", @click="top_apps_count += 5; queryWindows()")
        icon(name="angle-double-down")
        | Show more


</template>

<style lang="scss">
</style>

<script>
import moment from 'moment';
import time from "../util/time.js";

import 'vue-awesome/icons/arrow-left'
import 'vue-awesome/icons/arrow-right'
import 'vue-awesome/icons/angle-double-down'
import 'vue-awesome/icons/sync'

import query from '../queries.js';


export default {
  name: "Activity",
  data: () => {
    return {
      today: moment().startOf('day').format("YYYY-MM-DD"),

      // Query variables
      duration: "",
      errormsg: "",

      daily_activity: [],

      top_apps: [],
      top_apps_count: 5,
      top_apps_namefunc: (e) => e.data.app,
      top_apps_colorfunc: (e) => e.data.app,
    }
  },
  watch: {
    '$route': function() {
      console.log("Route changed");
      this.refresh();
    },
  },

  computed: {
    readableDuration: function() { return time.seconds_to_duration(this.duration) },
    host: function() { return this.$route.params.host },
    date: function() {
      var dateParam = this.$route.params.date;
      var dateMoment = dateParam ? moment(dateParam) : moment();
      return dateMoment.startOf('day').format();
    },
    dateStart: function() { return this.date },
    dateEnd: function() { return moment(this.date).add(1, 'days').format() },
    dateShort: function() { return moment(this.date).format("YYYY-MM-DD") },
    appBucketId: function() { return "aw-watcher-android-test" },
  },

  mounted: function() {
    this.refresh();
    this.testError();
  },

  methods: {
    previousDay: function() { return moment(this.dateStart).subtract(1, 'days').format("YYYY-MM-DD") },
    nextDay: function() { return moment(this.dateStart).add(1, 'days').format("YYYY-MM-DD") },
    setDate: function(date) { this.$router.push('/activity/'+this.host+'/'+date); },

    refresh: function() {
      this.queryAll();
      this.duration = "";
    },

    errorHandler: function(error) {
      this.errormsg = "" + error + ". See dev console (F12) and/or server logs for more info.";
      throw error;
    },

    queryAll: function() {
      this.duration = "";
      this.eventcount = 0;
      this.errormsg = "";

      this.queryApps();
      this.queryDailyActivity();
    },

    queryApps: async function() {
      var periods = [this.dateStart + "/" + this.dateEnd];
      var q = query.appQuery(this.appBucketId);
      let data = await this.$aw.query(periods, q).catch(this.errorHandler);
      data = data[0];
      this.top_apps = data["app_events"];
      this.total_duration = data["total_duration"];
    },

    queryDailyActivity: async function() {
      var timeperiods = [];
      for (var i=-15; i<=15; i++) {
        var startdate = moment(this.date).add(i, 'days').format();
        var enddate = moment(this.date).add(i+1, 'days').format();
        timeperiods.push(startdate + '/' + enddate);
      }
      this.daily_activity = await this.$aw.query(timeperiods, query.dailyActivityQuery(this.afkBucketId)).catch(this.errorHandler);
    },

    testError() {
      //throw 'error: some message';
    }
  },
}
</script>
