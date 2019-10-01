<template lang="pug">
div
  b-input-group(size="sm")
    b-input-group-prepend
      span.input-group-text
        | Bucket
    b-dropdown(:text="(browserBucketSelected !== 'all' && browserBucketSelected) || 'Select browser watcher bucket'", size="sm", variant="outline-secondary")
      b-dropdown-header
        | Browser bucket to use
      b-dropdown-item(v-if="browserBuckets.length <= 0", name="b", disabled)
        | No browser buckets available
        br
        small Make sure you have an browser extension installed
      b-dropdown-item-button(v-if="browserBuckets.length > 1", @click="browserBucketSelected = 'all'")
        | All
      b-dropdown-item-button(v-for="browserBucket in browserBuckets", :key="browserBucket", @click="browserBucketSelected = browserBucket")
        | {{ browserBucket }}
  br

  h6 Active browser time: {{ web_duration | friendlyduration }}

  div.row
    div.col-md-6
      h5 Top Browser Domains

      div(v-if="browserBuckets")
        aw-summary(:fields="top_web_domains", :namefunc="top_web_domains_namefunc", :colorfunc="top_web_domains_colorfunc")

    div.col-md-6
      h5 Top Browser URLs

      div(v-if="browserBuckets")
        aw-summary(:fields="top_web_urls", :namefunc="top_web_urls_namefunc", :colorfunc="top_web_urls_colorfunc")

  b-button(size="sm", variant="outline-secondary", :disabled="top_web_urls.length < top_web_count && top_web_domains.length < top_web_count" @click="top_web_count += 5; queryBrowserDomains()")
    icon(name="angle-double-down")
    | Show more

  hr

  b-form-checkbox(v-model="timelineShowAFK")
    | Show AFK time

  br

  aw-timeline-inspect(:chunks="web_chunks", :show_afk='timelineShowAFK', :chunkfunc='web_chunkfunc', :eventfunc='web_eventfunc')
</template>

<script>
import _ from 'lodash';
import { get_day_period } from '../util/time.js';
import query from '../queries.js';

export default {
  name: "Activity",
  props: ['host', 'date'],
  data: () => {
    return {
      filterAFK: true,
      timelineShowAFK: true,

      browserBuckets: [],
      browserBucketSelected: 'all',

      top_web_count: 5,
      web_duration: 0,

      web_chunks: [],
      web_chunkfunc: (e) => e.data.$domain,
      web_eventfunc: (e) => e.data.url,

      top_web_domains: [],
      top_web_domains_namefunc: (e) => e.data.$domain,
      top_web_domains_colorfunc: (e) => e.data.$domain,

      top_web_urls: [],
      top_web_urls_namefunc: (e) => e.data.url,
      top_web_urls_colorfunc: (e) => e.data.$domain,
    }
  },
  watch: {
    '$route': function() {
      console.log("Route changed");
      this.refresh();
    },
    filterAFK() {
      this.refresh();
    },
    browserBucketSelected() {
      this.queryBrowserDomains();
    },
    browserBuckets() {
      this.queryBrowserDomains();
    },
    editorBucketId() {
      this.queryEditorActivity();
    },
  },

  computed: {
    windowBucketId: function() { return "aw-watcher-window_" + this.host },
    afkBucketId:    function() { return "aw-watcher-afk_"    + this.host },
  },

  mounted: function() {
    this.getBrowserBucket();
    this.refresh();
  },

  methods: {
    refresh: function() {
      this.queryBrowserDomains();
    },

    getBrowserBucket: async function() {
      let buckets = await this.$aw.getBuckets().catch(this.errorHandler);
      this.browserBuckets = _.map(_.filter(buckets, (bucket) => bucket["type"] === "web.tab.current"), (bucket) => bucket["id"]);
    },

    queryBrowserDomains: async function() {
      let browserBuckets = this.browserBucketSelected == 'all' ? this.browserBuckets : [this.browserBucketSelected];
      if (browserBuckets) {
        var periods = [get_day_period(this.date)];
        var q = query.browserSummaryQuery(browserBuckets, this.windowBucketId, this.afkBucketId, this.top_web_count, this.filterAFK);
        let data = (await this.$aw.query(periods, q).catch(this.errorHandler))[0];
        this.web_duration = data["duration"];
        this.top_web_domains = data["domains"];
        this.top_web_urls = data["urls"];
        this.web_chunks = data["chunks"];
      }
    },
  },
}
</script>
