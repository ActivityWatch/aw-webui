<template lang="pug">
div#wrapper
  aw-header

  div(:class="{'container': !fullContainer, 'container-fluid': fullContainer}").px-0.px-md-2
    div.aw-container.my-3.p-3
      error-boundary
        user-satisfaction-poll
        new-release-notification(v-if="isNewReleaseCheckEnabled")
        router-view

  div.container(style="color: #555; font-size: 0.9em").px-0.px-md-2
    div(style="float: left")
      | Made with ❤ by the #[a(href="http://activitywatch.net/contributors/") ActivityWatch developers]
      div
        span.mt-2(v-show="info", style="color: #888; font-size: 0.8em")
          | #[b Version:] {{info.version}}.
          | #[b Host:] {{info.hostname}}
    div.footer
      a(href="https://twitter.com/ActivityWatchIt", target="_blank")
        icon(name="brands/twitter")
        | Twitter
      | #[a(href="https://github.com/ActivityWatch/activitywatch/issues/new/choose") File a bug]
      | #[a(href="https://forum.activitywatch.net/c/support") Join the Forum]
      | #[a(href="https://forum.activitywatch.net/c/features") Vote on the forum]
</template>

<script>
// only import the icons you use to reduce bundle size
import 'vue-awesome/icons/brands/twitter';

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
