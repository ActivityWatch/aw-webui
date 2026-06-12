<template lang="pug">
div
  b-alert(v-if="$isAndroid" show)
    b {{ $t('home.noteLabel') }}
    |  {{ $t('home.androidNote') }}

  h3 {{ $t('home.hello') }}
  p
    | {{ $t('home.introStart') }}
    span(v-if="$isAndroid") {{ $t('home.introAndroidSuffix') }}
    | {{ $t('home.introEnd') }}
  p
    | {{ $t('home.developerIntro') }}
  p
    div {{ $t('home.thankYou') }}
    small
      | {{ $t('home.surveyBefore') }}
      a(href="https://forms.gle/q2N9K5RoERBV8kqPA") {{ $t('home.userSurvey') }}
      | {{ $t('home.surveyBetween') }}
      a(href="https://forum.activitywatch.net/c/features") {{ $t('home.voteOnFeaturesForum') }}
      | {{ $t('home.surveyAfter') }}

  hr

  div.row
    div.col-md-6
      h4 {{ $t('home.spreadTitle') }}
      p
        | {{ $t('home.spreadIntro') }}
      ul
        li {{ $t('home.likeAndReview') }} #[a(href="https://alternativeto.net/software/activitywatch/") AlternativeTo]
        li {{ $t('home.voteOnProductHunt') }} #[a(href="https://www.producthunt.com/posts/activitywatch") ProductHunt]
        li
          span.mr-1 {{ $t('home.followAndSpread') }}
          a(href="https://twitter.com/ActivityWatchIt") Twitter
          span.mx-1 {{ $t('home.and') }}
          a(href="https://www.facebook.com/ActivityWatch") Facebook
        li {{ $t('home.starOn') }} #[a(href="https://github.com/ActivityWatch/activitywatch") GitHub]

    div.col-md-6
      h4 {{ $t('home.supportTitle') }}
      p
        | {{ $t('home.supportIntro') }}
        br
        | {{ $t('home.donateVia') }}
      ul
        li #[a(href="https://www.patreon.com/erikbjare") Patreon]
        li #[a(href="https://opencollective.com/activitywatch") Open Collective]
        li #[a(href="https://liberapay.com/ActivityWatch/") Liberapay]
        li #[a(href="https://activitywatch.net/donate/") {{ $t('home.otherMethods') }}] ({{ $t('home.includingCryptocurrency') }})
      p
        | {{ $t('home.donationPageIntro') }} #[a(href="https://activitywatch.net/donate/") {{ $t('home.donationPage') }}].

  hr

  div.row
    div.col-md-6
      h4 {{ $t('home.resourcesTitle') }}
      ul
        li #[a(href="https://activitywatch.net/") {{ $t('home.website') }}]
        li #[a(href="https://docs.activitywatch.net/") {{ $t('home.documentation') }}]
        li #[a(href="https://forum.activitywatch.net/") {{ $t('home.forum') }}]
        li #[a(href="https://discord.gg/vDskV9q") Discord]
        li #[a(href="https://www.reddit.com/r/activitywatch/") Reddit]
        li #[a(href="https://github.com/ActivityWatch/activitywatch") GitHub]
        li(v-if="!info.version.includes('rust')") #[a(:href="apiBrowserUrl") {{ $t('home.apiBrowser') }}]

    div.col-md-6
      h4 {{ $t('home.roadmapTitle') }}
      p
        | {{ $t('home.roadmapBefore') }}
        a(href="https://forum.activitywatch.net/c/news") {{ $t('home.developmentUpdates') }}
        | {{ $t('home.roadmapAfter') }}

  hr

  p
    small
      i
        | {{ $t('home.landingHintBefore') }}
        router-link(to="/settings") {{ $t('home.settings') }}
        | {{ $t('home.landingHintAfter') }}

</template>

<script lang="ts">
import { mapState } from 'pinia';
import { useServerStore } from '~/stores/server';

export default {
  name: 'Home',
  computed: {
    ...mapState(useServerStore, ['info']),
    // Resolve the API browser link relative to the current document so it
    // works when the webui is served behind a reverse proxy at a sub-path.
    apiBrowserUrl(): string {
      const base = window.location.pathname.replace(/[^/]*$/, '');
      return base + 'api/';
    },
  },
};
</script>
