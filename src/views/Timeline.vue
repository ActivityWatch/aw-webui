<template lang="pug">
div
  h2 Timeline

  input-timeinterval(v-model="daterange", :defaultDuration="timeintervalDefaultDuration", :maxDuration="maxDuration").mb-3

  // blocks
  div.d-inline-block.border.rounded.p-2.mr-2
    | Events shown:  {{ num_events }}
  div.d-inline-block.border.rounded.p-2.mr-2
    | Swimlanes:
    select(v-model="swimlane")
      option(:value='null') None
      option(value='category') Categories
      option(value='bucketType') Bucket Specific
  details.d-inline-block.bg-light.small.border.rounded.mr-2.px-2
    summary.p-2
      b Filters: {{ filter_summary }}
    div.p-2.bg-light
      table
        tr
          th.pt-2.pr-3
            label Host:
          td
              select(v-model="filter_hostname")
                option(:value='null') All
                option(v-for="host in hosts", :value="host") {{ host }}
        tr
          th.pt-2.pr-3
            label Client:
          td
            select(v-model="filter_client")
              option(:value='null') All
              option(v-for="client in clients", :value="client") {{ client }}
        tr
          th.pt-2.pr-3
            label Categories:
          td
            select(@change="onCategorySelect($event)", :value="''")
              option(value="" disabled) {{ filter_categories.length > 0 ? 'Add category...' : 'All' }}
              option(v-for="cat in category_options", :key="cat.text", :value="cat.text") {{ cat.text }}
            div.mt-1(v-if="filter_categories.length > 0")
              span.badge.badge-info.mr-1(v-for="(cat, idx) in filter_categories", :key="idx")
                | {{ cat.join(' > ') }}
                button.ml-1.close.small(@click="removeCategory(idx)", type="button", style="font-size: 0.8rem") &times;
  div.d-inline-block.border.rounded.p-2.mr-2(v-if="num_events !== 0")
    | Events shown: {{ num_events }}
  b-alert.d-inline-block.p-2.mb-0.mt-2(v-if="num_events === 0", variant="warning", show)
    | No events match selected criteria. Timeline is not updated.
  div.float-right.small.text-muted.pt-3
        tr
          th.pt-2.pr-3
            label Duration:
          td
            select(v-model="filter_duration")
              option(:value='null') All
              option(:value='2') 2+ secs
              option(:value='5') 5+ secs
              option(:value='10') 10+ secs
              option(:value='30') 30+ sec
              option(:value='1 * 60') 1+ mins
              option(:value='2 * 60') 2+ mins
              option(:value='3 * 60') 3+ mins
              option(:value='10 * 60') 10+ mins
              option(:value='30 * 60') 30+ mins
              option(:value='1 * 60 * 60') 1+ hrs
              option(:value='2 * 60 * 60') 2+ hrs
  div(style="float: right; color: #999").d-inline-block.pt-3
    | Drag to pan and scroll to zoom

  div(v-if="buckets !== null")
    div(style="clear: both")
    vis-timeline(:buckets="buckets", :showRowLabels='true', :queriedInterval="daterange", :swimlane="swimlane", :updateTimelineWindow='updateTimelineWindow')

    aw-devonly(reason="Not ready for production, still experimenting")
      aw-calendar(:buckets="buckets")
  div(v-else)
    h1.aw-loading Loading...
</template>

<script lang="ts">
import _ from 'lodash';
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';
import { useCategoryStore } from '~/stores/categories';
import { matchString } from '~/util/classes';
import { seconds_to_duration } from '~/util/time';

function getCategorizationString(bucket, e) {
  if (bucket.type == 'currentwindow') {
    return e.data.app + '\n' + e.data.title;
  } else if (bucket.type == 'web.tab.current') {
    return e.data.title + '\n' + e.data.url;
  } else if (bucket.type?.startsWith('app.editor')) {
    return e.data.file;
  } else if (bucket.type?.startsWith('general.stopwatch')) {
    return e.data.label;
  }
  return null;
}

export default {
  name: 'Timeline',
  data() {
    return {
      all_buckets: null,
      hosts: null,
      buckets: null,
      clients: null,
      daterange: null,
      maxDuration: 31 * 24 * 60 * 60,
      filter_hostname: null,
      filter_client: null,
      filter_duration: null,
      filter_categories: [],
      swimlane: null,
      updateTimelineWindow: true,
    };
  },
  computed: {
    timeintervalDefaultDuration() {
      const settingsStore = useSettingsStore();
      return Number(settingsStore.durationDefault);
    },
    // This does not match the chartData which is rendered in the timeline, as chartData excludes short events.
    num_events() {
      return _.sumBy(this.buckets, 'events.length');
    },
    category_options() {
      const categoryStore = useCategoryStore();
      return categoryStore.allCategoriesSelect;
    },
    filter_summary() {
      const desc = [];
      if (this.filter_hostname) {
        desc.push(this.filter_hostname);
      }
      if (this.filter_client) {
        desc.push(this.filter_client);
      }
      if (this.filter_duration > 0) {
        desc.push(seconds_to_duration(this.filter_duration));
      }
      if (this.filter_categories.length > 0) {
        desc.push(
          this.filter_categories.length +
            ' categor' +
            (this.filter_categories.length === 1 ? 'y' : 'ies')
        );
      }

      if (desc.length > 0) {
        return desc.join(', ');
      }
      return 'none';
    },
  },
  watch: {
    daterange() {
      this.updateTimelineWindow = true;
      this.getBuckets();
    },
    filter_hostname() {
      this.updateTimelineWindow = false;
      this.getBuckets();
    },
    filter_client() {
      this.updateTimelineWindow = false;
      this.getBuckets();
    },
    filter_duration() {
      this.updateTimelineWindow = false;
      this.getBuckets();
    },
    filter_categories() {
      this.updateTimelineWindow = false;
      this.getBuckets();
    },
    swimlane() {
      this.updateTimelineWindow = false;
      this.getBuckets();
    },
  },
  methods: {
    onCategorySelect(event) {
      const text = event.target.value;
      if (!text) return;
      const cat = this.category_options.find(c => c.text === text);
      if (cat && !this.filter_categories.some(fc => _.isEqual(fc, cat.value))) {
        this.filter_categories = [...this.filter_categories, cat.value];
      }
      event.target.value = '';
    },
    removeCategory(idx) {
      this.filter_categories = this.filter_categories.filter((_cat, i) => i !== idx);
    },
    getBuckets: async function () {
      if (this.daterange == null) return;

      this.all_buckets = Object.freeze(
        await useBucketsStore().getBucketsWithEvents({
          start: this.daterange[0].format(),
          end: this.daterange[1].format(),
        })
      );

      this.hosts = this.all_buckets
        .map(a => a.hostname)
        .filter((value, index, array) => array.indexOf(value) === index);
      this.clients = this.all_buckets
        .map(a => a.client)
        .filter((value, index, array) => array.indexOf(value) === index);

      let buckets = this.all_buckets;
      if (this.filter_hostname) {
        buckets = _.filter(buckets, b => b.hostname == this.filter_hostname);
      }
      if (this.filter_client) {
        buckets = _.filter(buckets, b => b.client == this.filter_client);
      }

      if (this.filter_duration > 0) {
        for (const bucket of buckets) {
          bucket.events = _.filter(bucket.events, e => e.duration >= this.filter_duration);
        }
      }

      if (this.filter_categories.length > 0) {
        const categoryStore = useCategoryStore();
        const allCats = categoryStore.classes;
        for (const bucket of buckets) {
          // Skip AFK buckets — they don't have meaningful categorization
          if (bucket.type === 'afkstatus') continue;
          bucket.events = _.filter(bucket.events, e => {
            const str = getCategorizationString(bucket, e);
            if (str === null) return true; // Keep events from unknown bucket types
            const matched = matchString(str, allCats);
            const eventCat = matched ? matched.name : ['Uncategorized'];
            // Check if the event's category matches any selected filter category
            // (including parent matches: selecting "Work" also shows "Work > Programming")
            return this.filter_categories.some(filterCat =>
              _.isEqual(eventCat.slice(0, filterCat.length), filterCat)
            );
          });
        }
      }

      this.buckets = buckets;
    },
  },
};
</script>

<style scoped>
details {
  position: relative;
}

details[open] summary ~ * {
  visibility: visible;
  position: absolute;
  border: 1px solid #ddd;
  border-radius: 5px;
  left: 0;
  top: 2.7em;
  background: white;
  z-index: 100;
}
</style>
