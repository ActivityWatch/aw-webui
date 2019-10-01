<template lang="pug">
div
  h2 Daily Activity for {{ dateShort }}

  p
    | Host: {{ host }}
    br
    | Active time: {{ duration | friendlyduration }}

  b-alert(variant="danger" :show="errormsg.length > 0")
    | {{ errormsg }}

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
      input.form-control(id="date" type="date" :value="dateShort" :max="today" @change="setDate($event.target.value)")

    div.p-1.ml-auto
      b-button-group
        b-button(@click="refresh()", variant="outline-dark")
          icon(name="sync")
          span.d-none.d-md-inline
            |  Refresh

  aw-periodusage(:periodusage_arr="daily_activity", :link_prefix="link_prefix")

  ul.nav.nav-tabs.my-3
    li.nav-item.aw-nav-item
      router-link.nav-link.aw-nav-link(:to="{ name: 'activity-daily-summary', params: $route.params }" :class="{ active: $route.path.includes('summary') }")
        h5 Summary
    li.nav-item.aw-nav-item
      router-link.nav-link.aw-nav-link(:to="{ name: 'activity-daily-window', params: $route.params }" :class="{ active: $route.path.includes('window') }")
        h5 Window
    li.nav-item.aw-nav-item
      router-link.nav-link.aw-nav-link(:to="{ name: 'activity-daily-browser', params: $route.params }" :class="{ active: $route.path.includes('browser') }")
        h5.active-h5 Browser
    li.nav-item.aw-nav-item
      router-link.nav-link.aw-nav-link(:to="{ name: 'activity-daily-editor', params: $route.params }" :class="{ active: $route.path.includes('editor') }")
        h5 Editor

  div
    router-view

  hr

  div.row
    div.col-md-6
      b Options
      div
        b-form-checkbox(v-model="filterAFK")
          | Filter away AFK time
</template>

<style lang="scss">

.aw-nav-link {
  background-color: #eee;
  border: 2px solid #eee !important;
  border-bottom: none !important;
  margin-left: 0.1em;
  margin-right: 0.1em;
  border-top-left-radius: 0.5rem !important;
  border-top-right-radius: 0.5rem !important;
}

.aw-nav-link:hover {
  background-color: #fff;
}

.aw-nav-item:hover {
  background-color: #fff !important;
}

</style>

<script>
import moment from 'moment';
import { seconds_to_duration, get_day_period } from "../util/time.js";

import 'vue-awesome/icons/arrow-left'
import 'vue-awesome/icons/arrow-right'
import 'vue-awesome/icons/angle-double-down'
import 'vue-awesome/icons/sync'

import query from '../queries.js';


export default {
  name: "Activity",
  props: ['host', 'date'],
  data: () => {
    return {
      today: moment().startOf('day').format("YYYY-MM-DD"),

      filterAFK: true,
      timelineShowAFK: true,

      // Query variables
      duration: "",
      errormsg: "",

      daily_activity: [],
    }
  },
  watch: {
    '$route': function() {
      console.log("Route changed");
      //this.refresh();
    },
    filterAFK() {
      this.refresh();
    },
    browserBucketSelected() {
      this.queryBrowserDomains();
    },
    browserBuckets() {
      this.queryBrowserDomains();
    },
    editorBucketId() {
      this.queryEditorActivity();
    },
  },

  computed: {
    dateShort: function() { return moment(this.date).format("YYYY-MM-DD") },
    windowBucketId: function() { return "aw-watcher-window_" + this.host },
    afkBucketId:    function() { return "aw-watcher-afk_"    + this.host },
    link_prefix:    function() { return "/activity/daily/"   + this.host },
  },

  mounted: function() {
    this.refresh();
  },

  methods: {
    previousDay: function() { return moment(this.date).subtract(1, 'days').format("YYYY-MM-DD") },
    nextDay: function() { return moment(this.date).add(1, 'days').format("YYYY-MM-DD") },
    setDate: function(date) { this.$router.push('/activity/daily/' + this.host + '/' + date); },

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

      this.queryDailyActivity();
    },

    queryDailyActivity: async function() {
      var timeperiods = [];
      for (var i=-15; i<=15; i++) {
        timeperiods.push(get_day_period(moment(this.date).add(i, 'days')));
      }
      this.daily_activity = await this.$aw.query(timeperiods, query.dailyActivityQuery(this.afkBucketId)).catch(this.errorHandler);
      console.log(this.daily_activity);
      this.duration = this.daily_activity[0][1].duration;
    },
  },
}
</script>
