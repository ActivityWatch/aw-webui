<template lang="pug">
div.mt-3
  // TODO: Add back option to select a specific browser bucket
  div(v-if="browserBuckets.length <= 0")
    h6 No browser buckets available
    small
      | This feature requires a browser watcher.
      | You can find a list of all watchers in #[a(href="https://activitywatch.readthedocs.io/en/latest/watchers.html") the documentation].

  div(v-if="browserBuckets.length > 0")
    h6 Active browser time: {{ $store.state.activity.browser.duration | friendlyduration }}

    div.row
      div.col-md-6
        h5 Top Browser Domains
        div(v-if="browserBuckets")
          aw-summary(:fields="$store.state.activity.browser.top_domains", :namefunc="e => e.data.$domain", :colorfunc="e => e.data.$domain", with_limit)

      div.col-md-6
        h5 Top Browser URLs
        div(v-if="browserBuckets")
          aw-summary(:fields="$store.state.activity.browser.top_urls", :namefunc="e => e.data.url", :colorfunc="e => e.data.$domain", with_limit)

  //div(v-if="periodLength === 'day'")
    br
    hr
    b-form-checkbox(v-model="timelineShowAFK")
      | Show AFK time
    aw-timeline-inspect(:chunks="$store.state.activity.web_chunks", :show_afk='timelineShowAFK', :chunkfunc='e => e.data.$domain', :eventfunc='e => e.data.url')
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
    browserBuckets: function () {
      return this.$store.state.activity.buckets.browser;
    },
  },
};
</script>
