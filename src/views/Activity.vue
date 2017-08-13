<template lang="pug">
div
  h2 Window Activity for {{ dateShort }}

  p Host: {{ host }}

  b-alert(variant="danger" :show="errormsg.length > 0")
    | {{ errormsg }}

  b-alert(show)
    | Check out the new today view! Currently in alpha.
    b-button(style="float: right" :to="'/today/' + host" size="sm" variant="info") Open today view

  //div.alert.alert-info(role="alert")
    small
      | This page is currently considered early work and is known to have issues:
      li
        a(href='https://github.com/ActivityWatch/aw-webui/issues/22')
          | Needs a date selector

  b-button-group
    b-button(:to="'/activity/' + host + '/' + previousDay()")
      icon(name="arrow-left")
      |  Previous day
    b-button(:to="'/activity/' + host + '/' + nextDay()", :disabled="nextDay() > today")
      |  Next day
      icon(name="arrow-right")
  b-button(v-on:click="query()", style="margin-left: 1rem;")
    icon(name="refresh")
    |  Refresh

  hr

  h4 Summary

  p Total time: {{ readableDuration }}

  div#appsummary-container

  hr

  h4 Window titles #[b-button(size="sm" v-on:click="numberOfWindowTitles += 5; queryWindowTitles()") Show 5 more]

  div#windowtitles-container

  hr

  h4 Timeline

  div#apptimeline-container

  hr

  p
    //| Showing activity from {{ dateStart }} until 24 hours later
    //br
    | Events queried: {{ eventcount }}

</template>

<style lang="scss">

#apptimeline-container {
    white-space: nowrap;
    font-family: sans-serif;
    font-size: 11pt;
    line-height: 1.2em;
}

</style>

<script>
import Resources from '../resources.js';
import moment from 'moment';
import timeline from '../visualizations/timeline.js';
import summary from '../visualizations/summary.js';
import time from "../util/time.js";
import event_parsing from "../util/event_parsing.js";

import 'vue-awesome/icons/arrow-left'
import 'vue-awesome/icons/arrow-right'
import 'vue-awesome/icons/refresh'

let $QueryView  = Resources.$QueryView;
let $CreateView  = Resources.$CreateView;
let $Info  = Resources.$Info;
let $Event  = Resources.$Event;

var daylength = 86400000;

export default {
  name: "Activity",
  data: () => {
    return {
      today: moment().format("YYYY-MM-DD"),

      // Query variables
      duration: "",
      eventcount: 0,
      errormsg: "",
      numberOfWindowTitles: 5
    }
  },

  watch: {
    '$route': function(to, from) {
      console.log("Route changed")
      this.query();
    }
  },

  computed: {
    readableDuration: function() { return time.seconds_to_duration(this.duration) },
    host: function() { return this.$route.params.host },
    date: function() { return this.$route.params.date || new Date().toISOString() },
    dateStart: function() { return moment(this.date).startOf('day').format() },
    dateShort: function() { return moment(this.date).format("YYYY-MM-DD") },
    windowBucketId: function() { return "aw-watcher-window" + (PRODUCTION ? "_" : "-testing_") + this.host },
    afkBucketId:    function() { return "aw-watcher-afk"    + (PRODUCTION ? "_" : "-testing_") + this.host }
  },

  mounted: function() {
    summary.create(document.getElementById("appsummary-container"));
    summary.create(document.getElementById("windowtitles-container"));
    timeline.create(document.getElementById("apptimeline-container"));

    this.query();
  },

  methods: {
    previousDay: function() { return moment(this.dateStart).subtract(1, 'days').format("YYYY-MM-DD") },
    nextDay: function() { return moment(this.dateStart).add(1, 'days').format("YYYY-MM-DD") },

    errorHandler: function(response) {
      console.error(response);
      this.errormsg = "Request error " + response.status + ". See F12 console for more info.";
    },

    query: function(){
      this.duration = "";
      this.eventcount = 0;
      this.errormsg = "";

      this.queryApps();
      this.queryWindowTitles();
      this.queryTimeline();
    },

    queryTimeline: function() {
      var timeline_view_name = "windowactivity_timeline@"+this.host;
      var query = this.windowTimelineQuery(this.windowBucketId, this.afkBucketId);
      $CreateView.save({viewname: timeline_view_name}, {'query': query}).then(
        (response) => { // Success
          if (response.status > 304){
            this.errorHandler(response);
          } else {
            this.queryViewTimeline(timeline_view_name);
          }
        }, this.errorHandler);
    },

    todaysEvents: function(bucket_id) {
      let today = moment(this.dateStart);
      return $Event.get({id: bucket_id, limit: -1,
                         start: today.format(), end: today.add(1, "days").format()});
    },

    filterByAFKAndGroup: function(groupingFunc) {
      return this.todaysEvents(this.windowBucketId)
        .then((response) => {
          let events = response.json();
          return this.todaysEvents(this.afkBucketId).then((response) => {
              let afkevents = response.json();
              let filteredevents = event_parsing.filterAFKTime(events, afkevents);

              let groups = _.groupBy(filteredevents, groupingFunc);
              let durations = _.mapValues(groups, (v, i) => _.reduce(v, (sum, o) => sum + o.duration, 0));

              // Sort objects by duration
              let durationPairs = _.sortBy(_.toPairs(durations), (a) => a[1]).reverse();
              return durationPairs;
          })
        }, this.errorHandler);
    },

    queryWindowTitles: function() {
      var container = document.getElementById("windowtitles-container")
      summary.set_status(container, "Loading...");

      this.filterByAFKAndGroup((o) => o.data.title)
          .then((durationPairs) => summary.updatePairs(container, _.take(durationPairs, this.numberOfWindowTitles)));
    },

    queryApps: function(viewname){
      var container = document.getElementById("appsummary-container")
      summary.set_status(container, "Loading...");

      this.filterByAFKAndGroup((o) => o.data.app)
          .then((durationPairs) => summary.updatePairs(container, _.take(durationPairs, this.numberOfWindowTitles)));
    },

    queryViewTimeline: function(viewname){
      var timeline_elem = document.getElementById("apptimeline-container")
      timeline.set_status(timeline_elem, "Loading...");

      let today = moment(this.dateStart);
      $QueryView.get({"viewname": viewname,
                      "limit": -1,
                      "start": today.format(),
                      "end": today.add(1, 'days').format()})
        .then((response) => {
          if (response.status > 304){
            this.errorHandler(response);
          } else {
            var data = response.json();
            var eventlist = data["eventlist"];
            this.duration = data["duration"];
            this.eventcount = data["eventcount"]+this.eventcount;
            var apptimeline = event_parsing.parse_eventlist_by_apps(eventlist);
            var el = document.getElementById("apptimeline-container")
            timeline.update(el, apptimeline, this.duration);
          }
        }, this.errorHandler);
    },


    windowTimelineQuery: function(windowbucket, afkbucket){
      return {
        'chunk': false,
        'cache': false,
        'transforms':
        [{
          'bucket': windowbucket,
          'filters':
          [{
            'name': 'timeperiod_intersect',
            'transforms':
            [{
              'bucket': afkbucket,
              'filters':
              [{
                'name': 'include_keyvals',
                'key': 'status',
                'vals': ['not-afk'],
              }]
            }]
          }]
        }]
      };
    },
  },
}
</script>
