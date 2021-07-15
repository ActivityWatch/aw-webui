<template lang="pug">
div#wrapper
  aw-header

  div(:class="{'container': !fullContainer, 'container-fluid': fullContainer}").px-0.px-md-3
    div.aw-container.my-3.p-3
      error-boundary
        user-satisfaction-poll
        new-release-notification(v-if="isNewReleaseCheckEnabled")
        router-view

  div.container(style="color: #555; font-size: 0.9em")
    div.mb-2
      | {{ $t('madeWith') }}
      a(href="https://activitywatch.net/donate/", target="_blank")
        icon(name="heart" scale=0.8 color="#E55")
      | {{ $t('madeBy') }} #[a(href="http://activitywatch.net/contributors/") {{ $t('devs') }}]
      div
        span.mt-2(v-show="info", style="color: #888; font-size: 0.8em")
          span.mr-2
            b {{ $t('host') }}
            | &nbsp; {{info.hostname}}
          span
            b {{ $t('version') }}
            | &nbsp; {{info.version}}

    div(style="font-size: 0.9em; opacity: 0.8")
      div.float-none.float-md-right.my-2
        a(href="https://github.com/ActivityWatch/activitywatch/issues/new/choose", target="_blank").mr-3
          icon(name="bug")
          | {{ $t('report') }}
        a(href="https://forum.activitywatch.net/c/support", target="_blank").mr-3
          icon(name="question-circle")
          | {{ $t('ask') }}
        a(href="https://forum.activitywatch.net/c/features", target="_blank")
          icon(name="vote-yea")
          | {{ $t('vote') }}
      div.float-none.float-md-left.my-2
        a(href="https://twitter.com/ActivityWatchIt", target="_blank")
          icon(name="brands/twitter")
          | Twitter
        a(href="https://github.com/ActivityWatch", target="_blank").ml-3
          icon(name="brands/github")
          | GitHub
        a(href="https://activitywatch.net/donate/", target="_blank").ml-3
          icon(name="hand-holding-heart")
          | {{ $t('donate') }}
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
