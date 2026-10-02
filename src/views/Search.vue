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
            td {{ e.timestamp | shortdate }} {{ e.timestamp | shorttime }}
            td {{ e.duration | friendlyduration }}
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
        ...useBucketsStore().desktopBucketIds(this.queryOptions.hostname),
        filter_afk: this.queryOptions.filter_afk,
        categories: [[['searched'], { type: 'regex', regex: this.pattern, ignore_case: true }]],
        filter_categories: [['searched']],
      });
      windowQuery += '; RETURN = events;';
      const windowQueryArray = querystr_to_array(windowQuery);

      try {
        this.status = 'searching';
        this.error = '';

        // Look up browser buckets for this host. A failure here (e.g. the bucket
        // list cannot be loaded) must not block the window-only search.
        let browserQueryArray: string[] = [];
        try {
          const bucketsStore = useBucketsStore();
          await bucketsStore.ensureLoaded();
          const browserBuckets = bucketsStore.bucketsBrowser(this.queryOptions.hostname);
          browserQueryArray = browserSearchQuery(browserBuckets, this.pattern);
        } catch (e) {
          console.error('Failed to load browser buckets for search', e);
        }

        // Run both queries; the browser query is skipped if no browser buckets.
        // Tolerate a browser-query failure so valid window results still render.
        const results = await Promise.all([
          this.$aw.query(timeperiods, windowQueryArray),
          browserQueryArray.length > 0
            ? this.$aw.query(timeperiods, browserQueryArray).catch(e => {
                console.error('Browser search failed', e);
                return null;
              })
            : Promise.resolve(null),
        ]);

        // Every window hit carries the synthetic `searched` category the query
        // uses for filtering; it is not a real category, so drop it from results.
        const windowEvents = results[0][0].map(e => ({ ...e, data: _.omit(e.data, '$category') }));
        this.events = _.orderBy(windowEvents, ['timestamp'], ['desc']);
        const browserResults = results[1] ? results[1][0] : [];
        // An event can match the pattern in both its url and title, which the
        // query concatenates into two entries; keep one row per event.
        this.browserEvents = _.orderBy(
          _.uniqBy(browserResults, (e: any) => `${e.timestamp}|${e.data?.url}`),
          ['timestamp'],
          ['desc']
        );
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
