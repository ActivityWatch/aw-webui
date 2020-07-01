<template lang="pug">
div
  h3 Hello early user,
  p
    | It's still early days for ActivityWatch. We've come a long way but we need users (like you!)
    | to provide feedback and help us turn ActivityWatch into a successful project.
    | Early users like you mean a lot to us, and we hope you'll reach out to us with any ideas you have for improvements!
  p
    | If you are a developer, we hope you can contribute by writing a watcher, visualization, or something else, and share it with us on the forum!
  p
    div Thank you for using ActivityWatch!
    small If you have a minute to spare, please take the time to fill out our #[a(href="https://forms.gle/q2N9K5RoERBV8kqPA") user survey] or #[a(href="https://forum.activitywatch.net/c/features") vote on features on the forum].

  hr

  div.row
    div.col-md-6
      h4 Spread the word
      p
        | Nothing is as motivating as getting ActivityWatch into the hands of users.
        | By sharing it you get us to make ActivityWatch even better!
      ul
        li Give us a like and a review on #[a(href="https://alternativeto.net/software/activitywatch/") AlternativeTo]
        li Vote on us at #[a(href="https://www.producthunt.com/posts/activitywatch") ProductHunt]
        li Follow us and spread the word on #[a(href="https://twitter.com/ActivityWatchIt") Twitter] and #[a(href="https://www.facebook.com/ActivityWatch") Facebook]
        li Star us on #[a(href="https://github.com/ActivityWatch/activitywatch") GitHub]

    div.col-md-6
      h4 Support us!
      p
        | Do you like ActivityWatch? Has it helped you? Help us help you by donating!
        | You can donate to us via:
      ul
        li #[a(href="https://www.patreon.com/erikbjare") Patreon]
        li #[a(href="https://opencollective.com/activitywatch") Open Collective]
        li #[a(href="https://liberapay.com/ActivityWatch/") Liberapay]
        li #[a(href="https://activitywatch.net/donate/") Other methods] (incl. cryptocurrency)
      p
        | For more info, please visit the #[a(href="https://activitywatch.net/donate/") donation page on the website].

  hr

  div.row
    div.col-md-6
      h4 Resources
      p
        ul
          li #[a(href="http://activitywatch.net/") Website]
          li #[a(href="https://activitywatch.readthedocs.org/") Documentation]
          li #[a(href="https://forum.activitywatch.net/") Forum]
          li #[a(href="https://github.com/ActivityWatch/activitywatch") GitHub]
          li #[a(href="/api/") API Browser]

    div.col-md-6
      h4 Want to know what we're working on?
      p
        | Check out the #[a(href="https://forum.activitywatch.net/c/news") development updates]!

</template>

<style scoped lang="scss"></style>

<script>
export default {
  name: 'Home',
};
</script>
