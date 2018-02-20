<template lang="pug">
div
  h2 Window Activity for {{ dateShort }}

  p Host: {{ host }}

  b-alert(variant="danger" :show="errormsg.length > 0")
    | {{ errormsg }}

  b-button-group
    b-button(:to="'/activity/' + host + '/' + previousDay()", variant="outline-dark")
      icon(name="arrow-left")
      |  Previous day
    b-button(:to="'/activity/' + host + '/' + nextDay()", :disabled="nextDay() > today", variant="outline-dark")
      |  Next day
      icon(name="arrow-right")
  b-button(v-on:click="refresh()", style="margin-left: 1rem;", variant="outline-dark")
    icon(name="refresh")
    |  Refresh

  hr

  div.row
    div.col-md-6
      h5 Summary
      | Total active time: {{ readableDuration }}
    div.col-md-6
      b Options
      div
        label.custom-control.custom-checkbox
          input.custom-control-input(type="checkbox", v-model="filterAFK")
          span.custom-control-indicator
          span.custom-control-description
            | Filter away AFK time

  hr

  div.row
    div.col-md-6
      h5 Top Applications

      div#appsummary-container

      b-button(size="sm", variant="outline-secondary", v-on:click="numberOfWindowApps += 5; queryApps()")
        icon(name="angle-double-down")
        | Show more

    div.col-md-6
      h5 Top Window Titles

      div#windowtitles-container

      b-button(size="sm", variant="outline-secondary", v-on:click="numberOfWindowTitles += 5; queryWindowTitles()")
        icon(name="angle-double-down")
        | Show more

  hr

  h4 Timeline

  label.custom-control.custom-checkbox
    input.custom-control-input(type="checkbox", v-model="timelineShowAFK")
    span.custom-control-indicator
    span.custom-control-description
      | Show AFK time

  div#apptimeline-container

  hr

  h4 Clock

  b-alert(variant="warning" show)
    | #[b Note:] This is an early version. It has known issues that will be resolved in a future update.
    | See #[a(href="https://github.com/ActivityWatch/aw-webui/issues/36") issue #36] for details.

  aw-sunburst(:date="date", :afkBucketId="afkBucketId", :windowBucketId="windowBucketId")

  hr

  h4 Top Browser Domains

  b-alert(variant="warning" show)
    | #[b Note:] This is an early version. It is missing basic functionality such as not working on all platforms and browsers. See #[a(href="https://github.com/ActivityWatch/activitywatch/issues/99") issue #99] for details.

  b-input-group(size="sm")
    b-input-group-addon
      | Browser bucket:
    b-input-group-button
      b-dropdown(:text="browserBucketId || 'Select browser watcher bucket'", size="sm", variant="outline-secondary")
        b-dropdown-item(v-if="browserBuckets.length <= 0", name="b", disabled)
          | No browser buckets available
          br
          small Make sure you have an browser extension installed
        b-dropdown-item-button(v-for="browserBucket in browserBuckets", :key="browserBucket", v-on:click="browserBucketId = browserBucket")
          | {{ browserBucket }}

  div(v-show="browserBucketId")
    br
    div#browserdomains-container

    b-button(size="sm", variant="outline-secondary", v-on:click="numberOfBrowserDomains += 5; queryBrowserDomains()")
      icon(name="angle-double-down")
      | Show more

  br

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
import moment from 'moment';
import timeline from '../visualizations/timeline.js';
import summary from '../visualizations/summary.js';
import time from '../util/time.js';
import event_parsing from '../util/event_parsing.js';

import 'vue-awesome/icons/arrow-left';
import 'vue-awesome/icons/arrow-right';
import 'vue-awesome/icons/angle-double-down';
import 'vue-awesome/icons/refresh';

import Sunburst from '../visualizations/Sunburst.vue';

import Resources from '../resources.js';
let $Query = Resources.$Query;
let $Info = Resources.$Info;
let $Bucket = Resources.$Bucket;
let $Event = Resources.$Event;

var daylength = 86400000;

export default {
  name: 'Activity',

  components: {
    'aw-sunburst': Sunburst,
  },

  data: () => {
    return {
      today: moment()
        .startOf('day')
        .format('YYYY-MM-DD'),

      filterAFK: true,
      timelineShowAFK: true,

      // Query variables
      duration: '',
      errormsg: '',
      numberOfWindowApps: 5,
      numberOfWindowTitles: 5,
      numberOfBrowserDomains: 5,

      browserBuckets: [],
      browserBucketId: '',
    };
  },

  computed: {
    readableDuration: function() {
      return time.seconds_to_duration(this.duration);
    },
    host: function() {
      return this.$route.params.host;
    },
    date: function() {
      return (
        this.$route.params.date ||
        moment()
          .startOf('day')
          .format()
      );
    },
    dateStart: function() {
      return moment(this.date)
        .startOf('day')
        .format();
    },
    dateShort: function() {
      return moment(this.date).format('YYYY-MM-DD');
    },
    windowBucketId: function() {
      return 'aw-watcher-window_' + this.host;
    },
    afkBucketId: function() {
      return 'aw-watcher-afk_' + this.host;
    },
  },

  watch: {
    $route: function(to, from) {
      console.log('Route changed');
      this.refresh();
    },
    filterAFK: function(to, from) {
      this.refresh();
    },
    timelineShowAFK: function(to, from) {
      this.refresh();
    },
    filterAFK: function(to, from) {
      this.refresh();
    },
    timelineShowAFK: function(to, from) {
      this.refresh();
    },
    browserBucketId: function(to, from) {
      this.queryBrowserDomains();
    },
  },

  mounted: function() {
    summary.create(document.getElementById('appsummary-container'));
    summary.create(document.getElementById('windowtitles-container'));
    summary.create(document.getElementById('browserdomains-container'));
    timeline.create(document.getElementById('apptimeline-container'));

    this.getBrowserBucket();

    this.refresh();
  },

  methods: {
    previousDay: function() {
      return moment(this.dateStart)
        .subtract(1, 'days')
        .format('YYYY-MM-DD');
    },
    nextDay: function() {
      return moment(this.dateStart)
        .add(1, 'days')
        .format('YYYY-MM-DD');
    },

    refresh: function() {
      this.query();
      this.duration = '';
      this.numberOfWindowApps = 5;
      this.numberOfWindowTitles = 5;
    },

    errorHandler: function(response) {
      console.error(response);
      this.errormsg =
        'Request error ' + response.status + '. See F12 console for more info.';
    },

    query: function() {
      this.duration = '';
      this.eventcount = 0;
      this.errormsg = '';

      this.queryApps();
      this.queryWindowTitles();
      this.queryBrowserDomains();
      this.queryTimeline();
    },

    getBrowserBucket: function() {
      $Bucket.get().then(response => {
        let buckets = response.json();
        for (var bucket in buckets) {
          if (buckets[bucket]['type'] === 'web.tab.current') {
            this.browserBuckets.push(bucket);
          }
        }
        if (this.browserBuckets.length > 0) {
          this.browserBucketId = this.browserBuckets[0];
        }
      });
    },

    queryTimeline: function() {
      let starttime = moment(this.dateStart).format();
      let endtime = moment(this.dateStart)
        .add(1, 'days')
        .format();

      var timeline_elem = document.getElementById('apptimeline-container');
      timeline.set_status(timeline_elem, 'Loading...');
      var query = this.windowTimelineQuery(
        this.windowBucketId,
        this.afkBucketId,
      );
      $Query
        .save(
          {
            name: 'window_timeline@' + this.host,
            start: starttime,
            end: endtime,
            cache: 0,
          },
          query,
        )
        .then(response => {
          // Success
          if (response.status > 304) {
            this.errorHandler(response);
          } else {
            var eventlist = response.json();
            var apptimeline = event_parsing.parse_eventlist_by_apps(eventlist);
            var total_duration = this.totalDuration(eventlist);
            this.duration = total_duration;
            timeline.update(
              timeline_elem,
              apptimeline,
              total_duration,
              this.timelineShowAFK,
            );
          }
        }, this.errorHandler);
    },

    queryWindowTitles: function() {
      let starttime = moment(this.dateStart).format();
      let endtime = moment(this.dateStart)
        .add(1, 'days')
        .format();

      var container = document.getElementById('windowtitles-container');
      summary.set_status(container, 'Loading...');
      var query = this.titleSummaryQuery(
        this.windowBucketId,
        this.afkBucketId,
        this.numberOfWindowTitles,
      );
      $Query
        .save(
          {
            name: 'title_summary@' + this.host,
            start: starttime,
            end: endtime,
            cache: 1,
          },
          query,
        )
        .then(response => {
          // Success
          if (response.status > 304) {
            this.errorHandler(response);
          } else {
            var summedEvents = response.json();
            summary.updateSummedEvents(
              container,
              summedEvents,
              e => e.data.title,
              e => e.data.app,
            );
          }
        }, this.errorHandler);
    },

    totalDuration: function(eventlist) {
      var duration = 0;
      for (var i in eventlist) {
        duration += eventlist[i].duration;
      }
      return duration;
    },

    queryApps: function() {
      let starttime = moment(this.dateStart).format();
      let endtime = moment(this.dateStart)
        .add(1, 'days')
        .format();

      var container = document.getElementById('appsummary-container');
      summary.set_status(container, 'Loading...');
      var query = this.appSummaryQuery(
        this.windowBucketId,
        this.afkBucketId,
        this.numberOfWindowApps,
      );
      $Query
        .save(
          {
            name: 'appsummary@' + this.host,
            start: starttime,
            end: endtime,
            cache: 1,
          },
          query,
        )
        .then(response => {
          // Success
          if (response.status > 304) {
            this.errorHandler(response);
          } else {
            var summedEvents = response.json();
            summary.updateSummedEvents(
              container,
              summedEvents,
              e => e.data.app,
              e => e.data.app,
            );
          }
        }, this.errorHandler);
    },

    queryBrowserDomains: function() {
      let starttime = moment(this.dateStart).format();
      let endtime = moment(this.dateStart)
        .add(1, 'days')
        .format();

      var container = document.getElementById('browserdomains-container');
      summary.set_status(container, 'Loading...');
      if (this.browserBucketId !== '') {
        var query = this.browserSummaryQuery(
          this.browserBucketId,
          this.windowBucketId,
          this.afkBucketId,
          this.numberOfBrowserDomains,
        );
        $Query
          .save(
            {
              name: 'browser_summary@' + this.host,
              start: starttime,
              end: endtime,
              cache: 1,
            },
            query,
          )
          .then(response => {
            // Success
            if (response.status > 304) {
              this.errorHandler(response);
            } else {
              var summedEvents = response.json();
              summary.updateSummedEvents(
                container,
                summedEvents,
                e => e.data.domain,
                e => e.data.domain,
              );
            }
          }, this.errorHandler);
      }
    },

    // TODO: Sanitize string input of buckets

    windowTimelineQuery: function(windowbucket, afkbucket) {
      return {
        query: [
          'not_afk = query_bucket("' + afkbucket + '");',
          'events  = query_bucket("' + windowbucket + '");',
          'not_afk = filter_keyvals(not_afk, "status", "not-afk");',
          'events  = filter_period_intersect(events, not_afk);',
          'events  = sort_by_timestamp(events);',
          'RETURN  = events;',
        ],
      };
    },

    appSummaryQuery: function(windowbucket, afkbucket, count) {
      return {
        query: [
          'not_afk = query_bucket("' + afkbucket + '");',
          'events  = query_bucket("' + windowbucket + '");',
          'not_afk = filter_keyvals(not_afk, "status", "not-afk");',
          'events  = filter_period_intersect(events, not_afk);',
          'events  = merge_events_by_keys(events, "app");',
          'events  = sort_by_duration(events);',
          'events  = limit_events(events, ' + count + ');',
          'RETURN  = events;',
        ],
      };
    },

    titleSummaryQuery: function(windowbucket, afkbucket, count) {
      return {
        query: [
          'not_afk=query_bucket("' + afkbucket + '");',
          'events=query_bucket("' + windowbucket + '");',
          'not_afk=filter_keyvals(not_afk, "status", "not-afk");',
          'events=filter_period_intersect(events, not_afk);',
          'events=merge_events_by_keys(events, "app", "title");',
          'events=sort_by_duration(events);',
          'events=limit_events(events, ' + count + ');',
          'RETURN=events;',
        ],
      };
    },

    browserSummaryQuery: function(
      browserbucket,
      windowbucket,
      afkbucket,
      count,
    ) {
      var browser_appnames = '';
      if (browserbucket.endsWith('-chrome')) {
        browser_appnames =
          '"Google-chrome", "chrome.exe", "Chromium", "Google Chrome"';
      } else if (browserbucket.endsWith('-firefox')) {
        browser_appnames = '"Firefox", "Firefox.exe", "firefox"';
      }
      return {
        query: [
          'events=query_bucket("' + browserbucket + '");',
          'not_afk=query_bucket("' + afkbucket + '");',
          'not_afk=filter_keyvals(not_afk, "status", "not-afk");',
          'window_browser=query_bucket("' + windowbucket + '");',
          'window_browser=filter_keyvals(window_browser, "app", ' +
            browser_appnames +
            ');',
          'window_browser=filter_period_intersect(window_browser, not_afk);',
          'events=filter_period_intersect(events, window_browser);',
          'events=split_url_events(events);',
          'events=merge_events_by_keys(events, "domain");',
          'events=sort_by_duration(events);',
          'events=limit_events(events, ' + count + ');',
          'RETURN=events;',
        ],
      };
    },
  },
};
</script>
