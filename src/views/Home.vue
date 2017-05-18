<template lang="jade">
h3 Hello there early user!
p
  | It's still early days for ActivityWatch. We've come a long way but we currently need users (like you!) to provide feedback and help us turn ActivityWatch into a successful project.
  | Your interest as an early user means extra much to us, and we hope you'll reach out to us with any ideas you have for improvements!
p
  | If you are a developer we hope you take a peek at the documentation (found in the links below) as well as try to write a watcher, visualizer or some other tool to help build an ecosystem (it's easy!).
p
  i Thanks for using ActivityWatch!

//
    hr
    h3 Status

    div.status.good
      div.icon
        span.glyphicon.glyphicon-ok-circle
      div.message
        | All good, or not, I don't know, because I lack an implementation.


    div.status.warning
      div.icon
        span.glyphicon.glyphicon-alert
      div.message
        | Something requires your attention, or not, I don't know, because I lack an implementation.

    div.status.bad
      div.icon
        span.glyphicon.glyphicon-fire
      div.message
        | Something is bad, or not, I don't know, because I lack an implementation.

h3 Resources

p
  ul
    li
      a(href="https://activitywatch.github.io/")
        | Website
    li
      a(href="https://github.com/ActivityWatch/activitywatch")
        | GitHub
    li
      a(href="https://activitywatch.readthedocs.org/")
        | Documentation
    li
      a(href="/api/")
        | API Documentation

</template>

<style lang="scss">
.status {
  line-height: 36pt;

  .icon {
    position: absolute;
    font-size: 32pt;
  }

  .message {
    margin-left: 40pt;
    font-size: 14pt;
  }

  &.good {
    color: green;
  }
  &.warning {
    color: orange;
  }
  &.bad {
    color: darkred;
  }
}

</style>

<script>
export default {
  name: "Home"
}
</script>
