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
    b-button.border-0(size="sm", variant="outline-dark" @click="show_options = !show_options")
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
    hr

    div.d-flex
      div.flex-fill
        | Found {{ events.length }} events in {{ queryTime / 1000 }} seconds
      div
        b-input-group(size="sm")
          b-input-group-prepend
            b-input-group-text
              icon(name="save")
              .mx-1 Export as:
          b-input-group-append
            b-button(type="button", @click="export_csv()" variant="outline-dark")
              | CSV
            b-button(type="button", @click="export_json()" variant="outline-dark")
              | JSON

    hr

    vis-timeline(:events="events.slice(0, 500)" filterShortEvents=true)
    div.small(v-if="events.length > 500")
      | Too many events, will only show last 500 events.

    hr

    aw-timeline-barchart(:datasets="datasets" :height="100")

    hr

    aw-selectable-eventview(:events="events")

    hr

    hr

    div
      | Didn't find what you were looking for?
      br
      | Add a week to the search: #[b-button(size="sm" variant="outline-dark" @click="start = start.subtract(1, 'week'); search()") +1 week]

</template>

<style scoped lang="scss"></style>

<script lang="ts">
import _ from 'lodash';
import moment from 'moment';
import Papa from 'papaparse';

import 'vue-awesome/icons/search';
import 'vue-awesome/icons/spinner';
import 'vue-awesome/icons/angle-double-down';
import 'vue-awesome/icons/angle-double-up';

import { canonicalEvents } from '~/queries';
import { buildBarchartDataset } from '~/util/datasets';

import { useActivityStore } from '~/stores/activity';
import { useCategoryStore } from '~/stores/categories';
import { useBucketsStore } from '~/stores/buckets';

import { getClient } from '~/util/awclient';

export default {
  name: 'Report',
  data() {
    return {
      activityStore: useActivityStore(),
      categoryStore: useCategoryStore(),
      bucketsStore: useBucketsStore(),

      events: null,

      status: null,
      queryTime: null,
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
        this.activityStore.category.by_period,
        this.categoryStore.classes
      );
    },
  },
  mounted: async function () {
    await this.bucketsStore.ensureLoaded();
  },
  methods: {
    generate: async function () {
      // TODO: use full query (one per day/timeperiod) instead of canonicalEvents
      let query = canonicalEvents({
        bid_window: 'aw-watcher-window_' + this.queryOptions.hostname,
        bid_afk: 'aw-watcher-afk_' + this.queryOptions.hostname,
        filter_afk: this.queryOptions.filter_afk,
        categories: this.filterCategories,
        filter_categories: this.filterCategories.map(c => c[0]),
      });
      query += '; RETURN = events;';

      const query_array = query.split(';').map(s => s.trim() + ';');
      const start = moment(this.queryOptions.start).format();
      const end = moment(this.queryOptions.stop).format();
      const timeperiods = [start + '/' + end];
      try {
        this.status = 'searching';
        const time = moment();
        const data = await getClient().query(timeperiods, query_array);
        this.events = _.orderBy(data[0], ['timestamp'], ['desc']);
        this.error = '';
        this.queryTime = moment().diff(time);
      } catch (e) {
        console.error(e);
        this.error = e.response.data.message;
      } finally {
        this.status = null;
      }
    },

    export_json() {
      const data = JSON.stringify(this.events, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'events.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },

    export_csv() {
      const data = this.events.map(e => {
        return [e.timestamp, e.duration, e.data['$category']];
      });
      const csv = Papa.unparse(data, { columns: ['timestamp', 'duration', 'category'] });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'events.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
  },
};
</script>
