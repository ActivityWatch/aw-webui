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
      | Made with ❤ by the #[a(href="http://activitywatch.net/contributors/") ActivityWatch developers]
      div
        span.mt-2(v-show="info", style="color: #888; font-size: 0.8em")
          | #[b Version:] {{info.version}}.
          | #[b Host:] {{info.hostname}}
    div.pb-3.mb-3
      div.float-left
        a(href="https://twitter.com/ActivityWatchIt", target="_blank").mr-2
          icon(name="brands/twitter")
          | Twitter
        a(href="https://github.com/ActivityWatch", target="_blank")
          icon(name="brands/github")
          | GitHub
      div.float-right
        a(href="https://github.com/ActivityWatch/activitywatch/issues/new/choose").mr-3
          | Report a bug
        a(href="https://forum.activitywatch.net/c/support").mr-3
          | Ask for help
        a(href="https://forum.activitywatch.net/c/features")
          | Vote for features
</template>

<script>
// only import the icons you use to reduce bundle size
import 'vue-awesome/icons/brands/twitter';
import 'vue-awesome/icons/brands/github';

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
