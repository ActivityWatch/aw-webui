<template lang="pug">
div
  h3 Search

  b-alert(v-if="error" show variant="danger")
    | {{error}}

  b-input-group(size="lg")
    b-input(v-model="pattern" v-on:keyup.enter="search()" placeholder="Regex pattern to search for")
    b-input-group-append
      b-button(type="button", @click="search()" variant="success")
        icon.mr-1(name="search")
        | Search

  div.d-flex.mt-1
    span.mr-auto.small.text-muted Hostname: {{queryOptions.hostname}}
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

  div(v-if="events != null || browserEvents != null")
    hr

    div(v-if="events && events.length > 0")
      h5 Window events ({{ events.length }})
      aw-selectable-eventview(:events="events")

    div(v-if="browserEvents && browserEvents.length > 0")
      h5 Browser events ({{ browserEvents.length }})
      table.table.table-sm.table-hover
        thead
          tr
            th Timestamp
            th Duration
            th URL
            th Title
        tbody
          tr(v-for="e in browserEvents" :key="e.id || e.timestamp")
            td {{ e.timestamp | moment("YYYY-MM-DD HH:mm:ss") }}
            td {{ e.duration | friendlyDuration }}
            td
              a(:href="e.data.url" target="_blank" rel="noopener") {{ e.data.url }}
            td {{ e.data.title }}

    div(v-if="events && events.length === 0 && (!browserEvents || browserEvents.length === 0)")
      p.text-muted No results found.

    div
      | Didn't find what you were looking for?
      br
      | Add a week to the search: #[b-button(size="sm" variant="outline-dark" @click="extendByWeek()") +1 week]
</template>

<script lang="ts">
import _ from 'lodash';
import moment from 'moment';
import { canonicalEvents, browserSearchQuery, querystr_to_array } from '~/queries';
import { useBucketsStore } from '~/stores/buckets';

import 'vue-awesome/icons/search';
import 'vue-awesome/icons/spinner';
import 'vue-awesome/icons/angle-double-down';
import 'vue-awesome/icons/angle-double-up';

export default {
  name: 'Search',
  data() {
    return {
      pattern: '',
      events: null,
      browserEvents: null,

      status: null,
      error: '',

      // Options
      show_options: false,
      queryOptions: {
        start: moment().subtract(1, 'day').format('YYYY-MM-DD'),
        stop: moment().add(1, 'day').format('YYYY-MM-DD'),
      },
    };
  },
  methods: {
    search: async function () {
      const timeperiods = [
        moment(this.queryOptions.start).format() + '/' + moment(this.queryOptions.stop).format(),
      ];

      // Window search query
      let windowQuery = canonicalEvents({
        bid_window: 'aw-watcher-window_' + this.queryOptions.hostname,
        bid_afk: 'aw-watcher-afk_' + this.queryOptions.hostname,
        filter_afk: this.queryOptions.filter_afk,
        categories: [[['searched'], { type: 'regex', regex: this.pattern, ignore_case: true }]],
        filter_categories: [['searched']],
      });
      windowQuery += '; RETURN = events;';
      const windowQueryArray = querystr_to_array(windowQuery);

      // Browser search query — look up available browser buckets for this host
      const bucketsStore = useBucketsStore();
      await bucketsStore.ensureLoaded();
      const browserBuckets = bucketsStore.bucketsBrowser(this.queryOptions.hostname);
      const browserQueryArray = browserSearchQuery(browserBuckets, this.pattern);

      try {
        this.status = 'searching';
        this.error = '';

        // Run both queries; browser query is skipped if no browser buckets
        const queries: Promise<any>[] = [this.$aw.query(timeperiods, windowQueryArray)];
        if (browserQueryArray.length > 0) {
          queries.push(this.$aw.query(timeperiods, browserQueryArray));
        }
        const results = await Promise.all(queries);

        this.events = _.orderBy(results[0][0], ['timestamp'], ['desc']);
        this.browserEvents =
          browserQueryArray.length > 0 ? _.orderBy(results[1][0], ['timestamp'], ['desc']) : [];
      } catch (e) {
        console.error(e);
        this.error = e.response?.data?.message ?? String(e);
      } finally {
        this.status = null;
      }
    },
    extendByWeek() {
      this.queryOptions.start = moment(this.queryOptions.start)
        .subtract(1, 'week')
        .format('YYYY-MM-DD');
      this.search();
    },
  },
};
</script>
