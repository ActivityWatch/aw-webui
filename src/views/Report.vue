<template lang="pug">
div
  h3 Report

  | Generate a report of time spent on a certain category of device activity.

  b-alert.mt-2(style="warning" show)
    | This feature is still in early development.

  b-alert(v-if="error" show variant="danger")
    | {{error}}

  // Let the user either choose a mode to use for filtering events.
  // Either let the user choose which of the existing categories to include, or use a custom regex.
  b-form-group
    b-form-select(v-model="mode")
      option(value="custom") Custom regex
      option(value="category") Use existing category

  // select which categories, by having a form select and a "plus" button to include them
  b-input-group
    b-form-select(v-if="mode == 'category'" v-model="category" placeholder="Select a category")
      b-form-select-option(v-for="category in categories" :key="category.id" :value="category.id")
        | {{category.name.join(" > ")}}
    b-input(v-if="mode == 'custom'" v-model="pattern" v-on:keyup.enter="generate()" placeholder="Regex pattern to search for")
    b-input-group-append
      b-button(type="button", @click="generate()" variant="success")
        icon(name="search")
        | Generate

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
      label Exclude time away from computer
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

    aw-selectable-eventview(:events="events")

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
  name: 'Report',
  data() {
    return {
      mode: 'category',
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
    };
  },
  computed: {
    categories: function () {
      return this.$store.state.categories.classes;
    },
  },
  mounted: async function () {
    await this.$store.dispatch('categories/load');
    await this.$store.dispatch('buckets/ensureBuckets');
    this.hostname = Object.keys(this.$store.getters['buckets/bucketsByHostname'])[0];
  },
  methods: {
    generate: async function () {
      // TODO: use full query (one per day/timeperiod) instead of canonicalEvents
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
  },
};
</script>
