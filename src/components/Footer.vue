<template lang="pug">
div.container(style="color: #555; font-size: 0.9em")
  div.mb-2
    | {{ $t('footer.madeWith') }}
    a(href="https://activitywatch.net/donate/", target="_blank" rel="noopener noreferrer")
      icon(name="heart" scale=0.75 style="color: #E55")
    | {{ $t('footer.byDevs') }}
    div
      span.mt-2(v-if="info", style="color: #888; font-size: 0.8em")
        span.me-2
          b {{ $t('footer.host') }}
          | &nbsp; {{info.hostname}}
        span
          b {{ $t('footer.version') }}
          | &nbsp; {{info.version}}

  div(style="font-size: 0.9em; opacity: 0.8; fill: #88F")
    div.float-none.float-md-end.my-2
      a(href="https://github.com/ActivityWatch/activitywatch/issues/new/choose", target="_blank" rel="noopener noreferrer").me-3
        icon(name="bug")
        | {{ $t('footer.reportBug') }}
      a(href="https://forum.activitywatch.net/c/support", target="_blank" rel="noopener noreferrer").me-3
        icon(name="question-circle")
        | {{ $t('footer.askHelp') }}
      a(href="https://forum.activitywatch.net/c/features", target="_blank" rel="noopener noreferrer")
        icon(name="vote-yea")
        | {{ $t('footer.voteFeatures') }}
    div.float-none.float-md-start.my-2
      a(href="https://twitter.com/ActivityWatchIt", target="_blank" rel="noopener noreferrer")
        icon(name="brands/twitter")
        | {{ $t('footer.twitter') }}
      a(href="https://github.com/ActivityWatch", target="_blank" rel="noopener noreferrer").ms-3
        icon(name="brands/github")
        | {{ $t('footer.github') }}
      a(href="https://www.reddit.com/r/activitywatch/", target="_blank" rel="noopener noreferrer").ms-3
        icon(name="brands/reddit")
        | {{ $t('footer.reddit') }}
      a(href="https://activitywatch.net/donate/", target="_blank" rel="noopener noreferrer").ms-3
        icon(name="hand-holding-heart")
        | {{ $t('footer.donate') }}
</template>

<script lang="ts">
import { mapState } from 'pinia';
import { useServerStore } from '~/stores/server';

export default {
  name: 'AwFooter',
  computed: {
    ...mapState(useServerStore, ['info']),
  },
};
</script>
