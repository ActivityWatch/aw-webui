<template lang="pug">
div
  b-alert(v-if="$isAndroid" show)
    | #[b {{ $t('note') }}] {{ $t('androidBeta') }}.

  h3 {{ $t('hello') }}
  p
    | {{ $t('early') }}#[span(v-if="$isAndroid") {{ $t('android') }}]. {{ $t('needUsers') }}
    | {{ $t('feedback') }}
    | {{ $t('mean') }}
  p
    | {{ $t('ifDev') }}
  p
    div {{ $t('ty') }}
    small {{ $t('minute') }} #[a(href="https://forms.gle/q2N9K5RoERBV8kqPA") {{ $t('survey') }}] {{ $t('or') }} #[a(href="https://forum.activitywatch.net/c/features") {{ $t('voteForum') }}].

  hr

  div.row
    div.col-md-6
      h4 {{ $t('spread') }}
      p
        | {{ $t('motivating') }}
        | {{ $t('better') }}
      ul
        li {{ $t('review') }} #[a(href="https://alternativeto.net/software/activitywatch/") AlternativeTo]
        li {{ $t('voteOn') }} #[a(href="https://www.producthunt.com/posts/activitywatch") ProductHunt]
        li {{ $t('follow') }} #[a(href="https://twitter.com/ActivityWatchIt") Twitter] {{ $t('and') }} #[a(href="https://www.facebook.com/ActivityWatch") Facebook]
        li {{ $t('star') }} #[a(href="https://github.com/ActivityWatch/activitywatch") GitHub]

    div.col-md-6
      h4 {{ $t('support') }}
      p
        | {{ $t('helpUs') }}
        | {{ $t('donateTo') }}
      ul
        li #[a(href="https://www.patreon.com/erikbjare") Patreon]
        li #[a(href="https://opencollective.com/activitywatch") Open Collective]
        li #[a(href="https://liberapay.com/ActivityWatch/") Liberapay]
        li #[a(href="https://activitywatch.net/donate/") {{ $t('other') }}] {{ $t('crypto') }}
      p
        | {{ $t('moreInfo') }} #[a(href="https://activitywatch.net/donate/") {{ $t('donationPage') }}].

  hr

  div.row
    div.col-md-6
      h4 {{ $t('resources') }}
      p
        ul
          li #[a(href="https://activitywatch.net/") {{ $t('website') }}]
          li #[a(href="https://activitywatch.readthedocs.org/") {{ $t('doc') }}]
          li #[a(href="https://forum.activitywatch.net/") {{ $t('forumCap') }}]
          li #[a(href="https://discord.gg/vDskV9q") Discord]
          li #[a(href="https://github.com/ActivityWatch/activitywatch") GitHub]
          li #[a(href="/api/") {{ $t('api') }}]

    div.col-md-6
      h4 {{ $t('know') }}
      p
        | {{ $t('checkOut') }} #[a(href="https://forum.activitywatch.net/c/news") {{ $t('devUpdate') }}]!

  hr

  p
    small
      i
        | {{ $t('changeHome') }} #[router-link(to="/settings") {{ $t('settings') }}].

</template>

<script>
export default {
  name: 'Home',
  data() {
    return {
      isAndroid: process.env.VUE_APP_ON_ANDROID,
    };
  },
};
</script>
