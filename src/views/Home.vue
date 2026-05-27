<template lang="pug">
div
  b-alert(v-if="$isAndroid" show)
    | #[b {{ $t('home.androidNote') }}]

  h3 {{ $t('home.title') }}
  p(v-if="$isAndroid") {{ $t('home.intro', { android: $t('home.introAndroid') }) }}
  p(v-else) {{ $t('home.intro', { android: '' }) }}
  p {{ $t('home.devInvite') }}
  p
    div {{ $t('home.thankYou') }}
    small(v-html="$t('home.surveyPrompt', { survey: '<a href=\"https://forms.gle/q2N9K5RoERBV8kqPA\">' + $t('home.survey') + '</a>', vote: '<a href=\"https://forum.activitywatch.net/c/features\">' + $t('home.voteFeatures') + '</a>' })")

  hr

  div.row
    div.col-md-6
      h4 {{ $t('home.spreadWord') }}
      p {{ $t('home.spreadDesc') }}
      ul
        li(v-html="$t('home.alternativeTo', { link: '<a href=\"https://alternativeto.net/software/activitywatch/\">AlternativeTo</a>' })")
        li(v-html="$t('home.productHunt', { link: '<a href=\"https://www.producthunt.com/posts/activitywatch\">ProductHunt</a>' })")
        li(v-html="$t('home.twitterFb', { twitter: '<a href=\"https://twitter.com/ActivityWatchIt\">Twitter</a>', facebook: '<a href=\"https://www.facebook.com/ActivityWatch\">Facebook</a>' })")
        li(v-html="$t('home.githubStar', { link: '<a href=\"https://github.com/ActivityWatch/activitywatch\">GitHub</a>' })")

    div.col-md-6
      h4 {{ $t('home.support') }}
      p {{ $t('home.supportDesc') }}
      ul
        li #[a(href="https://www.patreon.com/erikbjare") Patreon]
        li #[a(href="https://opencollective.com/activitywatch") Open Collective]
        li #[a(href="https://liberapay.com/ActivityWatch/") Liberapay]
        li #[a(href="https://activitywatch.net/donate/") Other methods] (incl. cryptocurrency)
      p(v-html="$t('home.donateMore', { link: '<a href=\"https://activitywatch.net/donate/\">' + $t('home.donatePage') + '</a>' })")

  hr

  div.row
    div.col-md-6
      h4 {{ $t('home.resources') }}
      p
        ul
          li #[a(href="https://activitywatch.net/") Website]
          li #[a(href="https://activitywatch.readthedocs.org/") Documentation]
          li #[a(href="https://forum.activitywatch.net/") Forum]
          li #[a(href="https://discord.gg/vDskV9q") Discord]
          li #[a(href="https://github.com/ActivityWatch/activitywatch") GitHub]
          li(v-if="!info.version.includes('rust')" ) #[a(href="/api/") API Browser]

    div.col-md-6
      h4 {{ $t('home.whatsNew') }}
      p(v-html="$t('home.devUpdates', { link: '<a href=\"https://forum.activitywatch.net/c/news\">' + $t('home.devUpdatesLink') + '</a>' })")

  hr

  p
    small
      i
        | You can change which page opens when you open ActivityWatch (instead of this page) in the #[router-link(to="/settings") settings].

</template>

<script lang="ts">
import { mapState } from 'pinia';
import { useServerStore } from '~/stores/server';

export default {
  name: 'Home',
  computed: {
    ...mapState(useServerStore, ['info']),
  },
};
</script>
