<template lang="pug">
div#wrapper
  aw-header

  div(:class="{'container': !fullContainer, 'container-fluid': fullContainer}").px-0.px-md-2
    div.aw-container.my-3.p-3
      error-boundary
        user-satisfaction-poll
        new-release-notification(v-if="isNewReleaseCheckEnabled")
        router-view

  div.container(style="color: #555; font-size: 0.9em")
    div.mb-2
      // The heart emoji is red by default on most platforms, but not on all
      | Made with #[span(style="color: red") ❤] by the #[a(href="http://activitywatch.net/contributors/") ActivityWatch developers]
      div
        span.mt-2(v-show="info", style="color: #888; font-size: 0.8em")
          span.mr-2
            b Host:
            | &nbsp; {{info.hostname}}
          span
            b Version:
            | &nbsp; {{info.version}}
    div.pb-3.pb-md-0.mb-3.mb-md-0(style="font-size: 0.9em; opacity: 0.9")
      div.float-none.float-md-right.mb-3
        a(href="https://github.com/ActivityWatch/activitywatch/issues/new/choose").mr-3
          icon(name="bug")
          | Report a bug
        a(href="https://forum.activitywatch.net/c/support").mr-3
          icon(name="question-circle")
          | Ask for help
        a(href="https://forum.activitywatch.net/c/features")
          icon(name="vote-yea")
          | Vote on features
      div.float-none.float-md-left
        a(href="https://twitter.com/ActivityWatchIt", target="_blank")
          icon(name="brands/twitter")
          | Twitter
        a(href="https://github.com/ActivityWatch", target="_blank").ml-3
          icon(name="brands/github")
          | GitHub
        a(href="https://activitywatch.net/donate/", target="_blank").ml-3
          icon(name="hand-holding-heart")
          | Donate
</template>

<script>
// only import the icons you use to reduce bundle size
import 'vue-awesome/icons/brands/twitter';
import 'vue-awesome/icons/brands/github';
import 'vue-awesome/icons/hand-holding-heart';
import 'vue-awesome/icons/vote-yea';
import 'vue-awesome/icons/question-circle';
import 'vue-awesome/icons/bug';

export default {
  data: function () {
    return {
      activityViews: [],
      info: {},
      isNewReleaseCheckEnabled: !process.env.VUE_APP_ON_ANDROID,
    };
  },

  computed: {
    fullContainer() {
      return this.$route.meta.fullContainer;
    },
  },

  mounted: async function () {
    this.$aw.getInfo().then(
      info => {
        this.info = info;
      },
      e => {
        console.error('Unable to connect: ', e);
        this.info = {};
      }
    );
  },
};
</script>
