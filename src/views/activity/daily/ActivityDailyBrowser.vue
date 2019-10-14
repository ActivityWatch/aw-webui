<template lang="pug">
div
  //b-input-group(size="sm")
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
  //br

  // h6 Active browser time: {{ web_duration | friendlyduration }}

  div.row
    div.col-md-6
      h5 Top Browser Domains
      div(v-if="browserBuckets")
        aw-summary(:fields="$store.state.activity_daily.top_domains", :namefunc="e => e.data.$domain", :colorfunc="e => e.data.$domain", with_limit)

    div.col-md-6
      h5 Top Browser URLs
      div(v-if="browserBuckets")
        aw-summary(:fields="$store.state.activity_daily.top_urls", :namefunc="e => e.data.url", :colorfunc="e => e.data.$domain", with_limit)

  hr

  b-form-checkbox(v-model="timelineShowAFK")
    | Show AFK time

  br

  aw-timeline-inspect(:chunks="$store.state.activity_daily.web_chunks", :show_afk='timelineShowAFK', :chunkfunc='e => e.data.$domain', :eventfunc='e => e.data.url')
</template>

<script>
import _ from 'lodash';

export default {
  name: "Activity",
  props: ['host', 'date'],
  data: () => {
    return {
      filterAFK: true,
      timelineShowAFK: true,

      // browserBucketSelected: 'all',

      top_web_count: 5,
    }
  },
  computed: {
    browserBuckets: function() { return this.$store.state.activity_daily.browser_buckets_available },
  },
}
</script>
