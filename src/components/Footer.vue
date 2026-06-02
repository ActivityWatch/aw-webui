<template lang="pug">
div.container(style="color: #555; font-size: 0.9em")
  div.mb-2
    | {{ $t('footer.madeWith') }}
    a(href="https://activitywatch.net/donate/", target="_blank")
      icon(name="heart" scale=0.75 style="fill: #E55")
    | {{ $t('footer.byDevs') }}
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
      a(href="https://github.com/ActivityWatch/activitywatch/issues/new/choose", target="_blank").mr-3
        icon(name="bug")
        | {{ $t('footer.reportBug') }}
      a(href="https://forum.activitywatch.net/c/support", target="_blank").mr-3
        icon(name="question-circle")
        | {{ $t('footer.askHelp') }}
      a(href="https://forum.activitywatch.net/c/features", target="_blank")
        icon(name="vote-yea")
        | {{ $t('footer.voteFeatures') }}
    div.float-none.float-md-left.my-2
      a(href="https://twitter.com/ActivityWatchIt", target="_blank")
        icon(name="brands/twitter")
        | {{ $t('footer.twitter') }}
      a(href="https://github.com/ActivityWatch", target="_blank").ml-3
        icon(name="brands/github")
        | {{ $t('footer.github') }}
      a(href="https://activitywatch.net/donate/", target="_blank").ml-3
        icon(name="hand-holding-heart")
        | {{ $t('footer.donate') }}
</template>

<script lang="ts">
import 'vue-awesome/icons/brands/twitter';
import 'vue-awesome/icons/brands/github';
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
