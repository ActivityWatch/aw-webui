<template lang="jade">
h2 Home

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
