<template lang="pug">
div
  h3 Graph

  b-alert(show variant="warning")
    | This feature is still in early development. See PR #[a(href="https://github.com/ActivityWatch/aw-webui/pull/365") aw-webui#365] for more information.

  | Displays a graph of categories and their transitions.

  b-alert.mt-2(style="warning" show)
    | This feature is still in early development.

  b-alert(v-if="error" show variant="danger")
    | {{error}}

  // Specify max category depth
  b-form-group(label="Max category depth")
    b-form-input(v-model="maxDepth" type="number" min="1")

  // Toggle to exclude uncategorized
  b-form-group(label="Exclude uncategorized")
    b-form-checkbox(v-model="excludeUncategorized")

  div.d-flex
    span.mr-auto
    b-button(type="button", @click="generate()" variant="success")
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

    div
        | Found {{ events.length }} events in {{ queryTime / 1000 }} seconds

    aw-force-graph(:data="graphdata")

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

import 'vue-awesome/icons/search';
import 'vue-awesome/icons/spinner';
import 'vue-awesome/icons/angle-double-down';
import 'vue-awesome/icons/angle-double-up';

import { canonicalEvents } from '~/queries';

import { useCategoryStore } from '~/stores/categories';

import { getClient } from '~/util/awclient';

export default {
  name: 'Graph',
  components: {
    'aw-force-graph': () => import('~/visualizations/ForceGraph.vue'),
  },
  data() {
    return {
      categoryStore: useCategoryStore(),

      events: null,
      graphdata: {},

      status: null,
      queryTime: null,
      error: '',

      // Parameters
      maxDepth: 3,
      excludeUncategorized: false,

      // Options
      show_options: false,
      queryOptions: {},
    };
  },
  mounted: async function () {
    await this.categoryStore.load();
  },
  methods: {
    generate: async function () {
      this.events = await this.fetchEvents();
      this.graphdata = this.generateGraphData(this.events);
    },
    fetchEvents: async function () {
      // TODO: use full query (one per day/timeperiod) instead of canonicalEvents
      let query = canonicalEvents({
        bid_window: 'aw-watcher-window_' + this.queryOptions.hostname,
        bid_afk: 'aw-watcher-afk_' + this.queryOptions.hostname,
        filter_afk: this.queryOptions.filter_afk,
        categories: this.categoryStore.classes_for_query,
        filter_categories: this.excludeUncategorized
          ? this.categoryStore.classes_for_query.map(t => t[0])
          : null,
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
        this.error = '';
        this.queryTime = moment().diff(time);
        console.log('done fetching events!');
        this.events = _.orderBy(data[0], ['timestamp'], ['desc']);
      } catch (e) {
        console.error(e);
        this.error = e.response.data.message;
      } finally {
        this.status = null;
      }
      return this.events;
    },
    generateGraphData: function (events) {
      // generate graph data from events
      // iterate through events, and count the number of category transitions
      // for each category, add a node to the graphdata with the group of its parent category
      // for each transition-pair, add a link to the graphdata with the number of transitions as weight
      const SEP = '>';

      // copy all events, slice off category depth deeper than maxDepth
      events = events.map(e => {
        const $category = e.data.$category.slice(0, this.maxDepth);
        return { ...e, data: { ...e.data, $category } };
      });

      const allCategories = new Set(events.map(e => e.data.$category).map(c => c.join(SEP)));
      const groups = { Uncategorized: 0 };

      // Generate groups
      for (const category of allCategories) {
        const rootcat = category.split(SEP)[0];
        if (!Object.prototype.hasOwnProperty.call(groups, rootcat)) {
          groups[rootcat] = Object.keys(groups).length;
        }
      }

      // Generate nodes
      const nodes = [];
      for (const category of allCategories) {
        const rootcat = category.split(SEP)[0];
        // Size nodes depending on time spent
        const catTime = events
          .filter(e => e.data.$category.join(SEP) == category)
          .map(e => moment(e.timestamp).add(e.duration).diff(e.timestamp))
          .reduce((a, b) => a + b, 0);
        nodes.push({
          id: category,
          group: groups[rootcat],
          color: this.categoryStore.get_category_color(category.split(SEP)),
          value: catTime,
        });
      }

      // Generate links
      const links = [];
      for (let i = 0; i < events.length - 1; i++) {
        const e1 = events[i];
        const e2 = events[i + 1];
        const e1cat = e1.data.$category;
        const e2cat = e2.data.$category;
        if (_.isEqual(e1cat, e2cat)) continue;

        const link = links.find(l => l.source == e1cat.join(SEP) && l.target == e2cat.join(SEP));
        if (link) {
          link.value++;
        } else {
          links.push({
            source: e1cat.join(SEP),
            target: e2cat.join(SEP),
            value: 1,
          });
        }
      }

      console.log('generated nodes & links');
      return { nodes, links };
    },
  },
};
</script>
