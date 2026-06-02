<template lang="pug">
div
  b-alert(v-if="$isAndroid" show)
    | #[b {{ $t('home.note') }}] {{ $t('home.androidNote') }}

  h3 {{ $t('home.greeting') }}
  p
    | {{ homeIntro1 }}
  p
    | {{ $t('home.intro2') }}
  p
    | {{ $t('home.intro3') }}
  p
    div {{ $t('home.thanks') }}
    small
      | {{ $t('home.surveyPrefix') }}
      |  #[a(href="https://forms.gle/q2N9K5RoERBV8kqPA") {{ $t('home.survey') }}]
      |  {{ $t('home.surveyOr') }}
      |  #[a(href="https://forum.activitywatch.net/c/features") {{ $t('home.voteForum') }}].

  hr

  div.row
    div.col-md-6
      h4 {{ $t('home.spreadTitle') }}
      p
        | {{ $t('home.spread1') }}
      ul
        li
          | {{ $t('home.spreadReview') }}
          |  #[a(href="https://alternativeto.net/software/activitywatch/") AlternativeTo]
        li
          | {{ $t('home.spreadVote') }}
          |  #[a(href="https://www.producthunt.com/posts/activitywatch") ProductHunt]
        li
          | {{ $t('home.spreadFollow') }}
          |  #[a(href="https://twitter.com/ActivityWatchIt") Twitter]
          |  /
          |  #[a(href="https://www.facebook.com/ActivityWatch") Facebook]
        li
          | {{ $t('home.spreadStar') }}
          |  #[a(href="https://github.com/ActivityWatch/activitywatch") GitHub]

    div.col-md-6
      h4 {{ $t('home.supportTitle') }}
      p
        | {{ $t('home.support1') }}
      ul
        li #[a(href="https://www.patreon.com/erikbjare") Patreon]
        li #[a(href="https://opencollective.com/activitywatch") Open Collective]
        li #[a(href="https://liberapay.com/ActivityWatch/") Liberapay]
        li #[a(href="https://activitywatch.net/donate/") {{ $t('footer.donate') }}]
      p
        | {{ $t('home.support2') }}
        |  #[a(href="https://activitywatch.net/donate/") {{ $t('home.donationPage') }}].

  hr

  div.row
    div.col-md-6
      h4 {{ $t('home.resourcesTitle') }}
      p
        ul
          li #[a(href="https://activitywatch.net/") {{ $t('home.website') }}]
          li #[a(href="https://activitywatch.readthedocs.org/") {{ $t('home.documentation') }}]
          li #[a(href="https://forum.activitywatch.net/") {{ $t('home.forum') }}]
          li #[a(href="https://discord.gg/vDskV9q") {{ $t('home.discord') }}]
          li #[a(href="https://github.com/ActivityWatch/activitywatch") GitHub]
          li(v-if="!info.version.includes('rust')" ) #[a(href="/api/") {{ $t('home.apiBrowser') }}]

    div.col-md-6
      h4 {{ $t('home.workingOnTitle') }}
      p
        | {{ $t('home.workingOn') }}
        |  #[a(href="https://forum.activitywatch.net/c/news") {{ $t('home.devUpdates') }}]!

  hr

  p
    small
      i
        | {{ $t('home.landingHint') }}
        |  #[router-link(to="/settings") {{ $t('nav.settings') }}].

</template>

<script lang="ts">
import { mapState } from 'pinia';
import { useServerStore } from '~/stores/server';

export default {
  name: 'Home',
  computed: {
    ...mapState(useServerStore, ['info']),
    homeIntro1() {
      const android = this.$isAndroid ? this.$t('home.introAndroid') : '';
      return this.$t('home.intro1', { android });
    },
  },
};
</script>
