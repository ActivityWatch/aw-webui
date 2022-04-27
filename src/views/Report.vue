<template lang="pug">
div
  h3 Report

  | Generate a report of time spent on a certain category of device activity.

  b-alert.mt-2(style="warning" show)
    | This feature is still in early development.

  b-alert(v-if="error" show variant="danger")
    | {{error}}

  aw-select-categories-or-pattern(v-model="filterCategories")
    template(v-slot:input-group-append)
      b-button(type="button", @click="generate()" variant="success" :disabled="!has_pattern")
        icon(name="search")
        | Generate

  div.d-flex.mt-1
    span.mr-auto.small(style="color: #666") Hostname: {{queryOptions.hostname}}
    b-button(size="sm", variant="outline-dark" style="border: 0" @click="show_options = !show_options")
      span(v-if="!show_options")
        | #[icon(name="angle-double-down")] Show options
      span(v-else)
        | #[icon(name="angle-double-up")] Hide options

  div(v-show="show_options")
    h4 Options
    aw-query-options(v-model="queryOptions")

  div(v-if="status == 'searching'")
    div #[icon(name="spinner" pulse)] Searching...

  div(v-if="events != null")
    vis-timeline(:events="events" filterShortEvents=true)
    div {{ events.length }} events

    hr

    aw-timeline-barchart(:datasets="datasets" :height="100")

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
import { buildBarchartDataset } from '~/util/datasets';

import 'vue-awesome/icons/search';
import 'vue-awesome/icons/spinner';
import 'vue-awesome/icons/angle-double-down';
import 'vue-awesome/icons/angle-double-up';

export default {
  name: 'Report',
  data() {
    return {
      events: null,

      status: null,
      error: '',

      // Options
      show_options: false,
      queryOptions: {},
      filterCategories: [],
    };
  },
  computed: {
    has_pattern: function () {
      return this.filterCategories.length > 0;
    },
    datasets: function () {
      return buildBarchartDataset(
        this.$store,
        this.$store.state.activity.category.by_period,
        this.$store.state.activity.active.events,
        this.$store.state.categories.classes
      );
    },
  },
  mounted: async function () {
    await this.$store.dispatch('buckets/ensureBuckets');
  },
  methods: {
    generate: async function () {
      // TODO: use full query (one per day/timeperiod) instead of canonicalEvents
      let query = canonicalEvents({
        bid_window: 'aw-watcher-window_' + this.queryOptions.hostname,
        bid_afk: 'aw-watcher-afk_' + this.queryOptions.hostname,
        filter_afk: this.queryOptions.filter_afk,
        classes: this.filterCategories,
        filter_classes: this.filterCategories.map(c => c[0]),
      });
      query += '; RETURN = events;';

      const query_array = query.split(';').map(s => s.trim() + ';');
      const start = moment(this.queryOptions.start).format();
      const end = moment(this.queryOptions.stop).format();
      const timeperiods = [start + '/' + end];
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
