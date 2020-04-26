<template lang="pug">
div
  // TODO: Add back option to select a specific browser bucket
  div(v-if="browserBuckets.length <= 0")
    h6 No browser buckets available
    small Make sure you have a browser watcher installed to use this feature
  div(v-if="browserBuckets.length > 0")

    h6 Active browser time: {{ $store.state.activity_daily.browser.duration | friendlyduration }}

    div.row
      div.col-md-6
        h5 Top Browser Domains
        div(v-if="browserBuckets")
          aw-summary(:fields="$store.state.activity_daily.browser.top_domains", :namefunc="e => e.data.$domain", :colorfunc="e => e.data.$domain", with_limit)

      div.col-md-6
        h5 Top Browser URLs
        div(v-if="browserBuckets")
          aw-summary(:fields="$store.state.activity_daily.browser.top_urls", :namefunc="e => e.data.url", :colorfunc="e => e.data.$domain", with_limit)

  //div(v-if="periodLength === 'day'")
    br
    hr
    b-form-checkbox(v-model="timelineShowAFK")
      | Show AFK time
    aw-timeline-inspect(:chunks="$store.state.activity_daily.web_chunks", :show_afk='timelineShowAFK', :chunkfunc='e => e.data.$domain', :eventfunc='e => e.data.url')
  br
</template>

<script>
export default {
  name: 'Activity',
  props: {
    periodLength: {
      type: String,
      default: 'day',
    },
  },
  data: () => {
    return {
      filterAFK: true,
      timelineShowAFK: true,

      // browserBucketSelected: 'all',

      top_web_count: 5,
    };
  },
  computed: {
    browserBuckets: function() {
      return this.$store.state.activity_daily.buckets.browser_buckets;
    },
  },
};
</script>
