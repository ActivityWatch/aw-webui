<template lang="pug">

div
  h3 Search

  div.alert.alert-danger(v-if="error")
    | {{error}}

  b-input-group(size="lg")
    b-input(v-model="pattern" placeholder="Regex pattern to search for")
    b-input-group-append
      b-button(type="button", @click="search()" variant="success")
        icon(name="search")
        | Search

  div.d-flex.mt-1
    span.mr-auto.small(style="color: #666") Hostname: {{hostname}}
    b-button(size="sm", variant="outline-dark" style="border: 0" @click="show_options = !show_options")
      span(v-if="!show_options")
        | #[icon(name="angle-double-down")] Show options
      span(v-else)
        | #[icon(name="angle-double-up")] Hide options

  div(v-if="show_options")
    h4 Options
    div Hostname
      select(v-model="hostname")
        option(v-for="hostname in Object.keys($store.getters['buckets/bucketsByHostname'])")
          | {{hostname}}
    div Start: {{start.format()}}
    div End: {{stop.format()}}
    //div
      label Use regex
      input(type="checkbox" v-model="use_regex")
    div
      label Filter AFK
      input(type="checkbox" v-model="filter_afk")
    //div.form-row
      div.form-group.col-md-6
        | Start
        input.form-control(type="date", :max="today", v-model="startdate")
      div.form-group.col-md-6
        | End
        input.form-control(type="date", :max="tomorrow", v-model="enddate")

    div.form-inline

  div(v-if="status == 'searching'")
    div #[icon(name="spinner" pulse)] Searching...

  div(v-if="events != null")
    hr

    div.form-group
      select.form-control(v-model="vis_method")
        option(value="eventlist") Event List
        option(value="timeline") Timeline
        option(value="summary") Summary
        option(value="raw") Raw JSON

    div(v-if="vis_method == 'timeline'")
      aw-timeline(type="simple", :event_type="event_type", :events="events")
    div(v-if="vis_method == 'eventlist'")
      aw-eventlist(:events="events")
    div(v-if="vis_method == 'summary'")
      input.form-control(type="text" v-model.lazy.trim="summaryKey" placeholder="data key" style="margin-bottom: 1em;")
      aw-summary(:fields="events", :colorfunc="colorfunc", :namefunc="namefunc")
    div(v-if="vis_method == 'raw'")
      pre {{ events }}

    div
      | Didn't find what you were looking for?
      br
      | Add a week to the search: #[b-button(size="sm" variant="outline-dark" @click="start = start.subtract(1, 'week'); search()") +1 week]

</template>

<style scoped lang="scss"></style>

<script>
import _ from 'lodash';
import moment from 'moment';
import { canonicalEvents } from '~/queries';

import 'vue-awesome/icons/search';
import 'vue-awesome/icons/spinner';
import 'vue-awesome/icons/angle-double-down';
import 'vue-awesome/icons/angle-double-up';

export default {
  name: 'Search',
  data() {
    return {
      pattern: '',
      vis_method: 'eventlist',
      event_type: 'currentwindow',
      events: null,
      error: '',
      status: null,
      hostname: '',

      // Options
      show_options: false,
      use_regex: true,
      filter_afk: true,
      start: moment().subtract(1, 'day'),
      stop: moment().add(1, 'day'),

      /* Summary props */
      summaryKey: 'title',
      colorfunc: null,
      namefunc: null,
    };
  },
  mounted: async function () {
    this.colorfunc = this.summaryKeyFunc;
    this.namefunc = this.summaryKeyFunc;
    await this.$store.dispatch('buckets/ensureBuckets');
    this.hostname = Object.keys(this.$store.getters['buckets/bucketsByHostname'])[0];
  },
  methods: {
    search: async function () {
      let query = canonicalEvents({
        bid_window: 'aw-watcher-window_' + this.hostname,
        bid_afk: 'aw-watcher-afk_' + this.hostname,
        filter_afk: this.filter_afk,
        classes: [[['searched'], { type: 'regex', regex: this.pattern }]],
        filter_classes: [['searched']],
      });
      query += '; RETURN = events;';

      const query_array = query.split(';').map(s => s.trim() + ';');
      const timeperiods = [this.start.format() + '/' + this.stop.format()];
      try {
        this.status = 'searching';
        const data = await this.$aw.query(timeperiods, query_array);
        this.events = _.orderBy(data[0], ['timestamp'], ['desc']);
        this.error = '';
      } catch (e) {
        console.error(e);
        this.error = e.response.data.message;
      } finally {
        this.status = null;
      }
    },
    summaryKeyFunc: function (e) {
      return e.data[this.summaryKey];
    },
  },
};
</script>