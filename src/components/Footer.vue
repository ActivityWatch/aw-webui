<template lang="pug">
div.container(style="color: #555; font-size: 0.9em")
  div.mb-2
    span {{ $t('footer.madeWith') }}
    a(href="https://activitywatch.net/donate/", target="_blank" rel="noopener noreferrer")
      icon(name="heart" scale=0.75 style="fill: #E55")
    span {{ $t('footer.by') }}
    a(href="http://activitywatch.net/contributors/") {{ $t('footer.developers') }}
    div
      span.mt-2(v-if="info", style="color: #888; font-size: 0.8em")
        span.mr-2
          b {{ $t('footer.host') }}
          | &nbsp; {{info.hostname}}
        span
          b {{ $t('footer.version') }}
          | &nbsp; {{info.version}}

  div(style="font-size: 0.9em; opacity: 0.8; fill: #88F")
    div.float-none.float-md-right.my-2
      a(href="https://github.com/ActivityWatch/activitywatch/issues/new/choose", target="_blank" rel="noopener noreferrer").mr-3
        icon(name="bug")
        | {{ $t('footer.reportBug') }}
      a(href="https://forum.activitywatch.net/c/support", target="_blank" rel="noopener noreferrer").mr-3
        icon(name="question-circle")
        | {{ $t('footer.askForHelp') }}
      a(href="https://forum.activitywatch.net/c/features", target="_blank" rel="noopener noreferrer")
        icon(name="vote-yea")
        | {{ $t('footer.voteOnFeatures') }}
    div.float-none.float-md-left.my-2
      a(href="https://twitter.com/ActivityWatchIt", target="_blank" rel="noopener noreferrer")
        icon(name="brands/twitter")
        | Twitter
      a(href="https://github.com/ActivityWatch", target="_blank" rel="noopener noreferrer").ml-3
        icon(name="brands/github")
        | GitHub
      a(href="https://www.reddit.com/r/activitywatch/", target="_blank" rel="noopener noreferrer").ml-3
        icon(name="brands/reddit")
        | Reddit
      a(href="https://activitywatch.net/donate/", target="_blank" rel="noopener noreferrer").ml-3
        icon(name="hand-holding-heart")
        | {{ $t('footer.donate') }}
</template>

<script lang="ts">
// only import the icons you use to reduce bundle size
import 'vue-awesome/icons/brands/twitter';
import 'vue-awesome/icons/brands/github';
import 'vue-awesome/icons/brands/reddit';
import 'vue-awesome/icons/hand-holding-heart';
import 'vue-awesome/icons/vote-yea';
import 'vue-awesome/icons/question-circle';
import 'vue-awesome/icons/bug';
import 'vue-awesome/icons/heart';

import { mapState } from 'pinia';
import { useServerStore } from '~/stores/server';

export default {
  name: 'Footer',
  computed: {
    ...mapState(useServerStore, ['info']),
  },
};
</script>
