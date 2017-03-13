<template lang="jade">
div#wrapper
  div.header
    div.container
      span.title
        img(src="/static/logo.png")
        span(style="padding-left: 15px;")
        | ActivityWatch
      //usermenu
  div.container.aw-container
    nav.row.navbar.aw-navbar
      ul.nav.navbar-nav
        li(v-for="entry in menuEntries")
          router-link(to="{ path: entry.path, exact: entry.exact }")
            span(v-bind:class="'menuicon ' + entry.iconCssClass")
            | {{ entry.label }}
    div
      router-view

  // TODO: Add link to website here when it contains something of interest
  div.container(style="margin-top: 1rem; margin-bottom: 1rem; color: #555")
    | Made with ❤ by the ActivityWatch developers

    div(style="float: right; text-align: right;")
      div
        | Follow ActivityWatch:
        a.outlinks(href="https://github.com/ActivityWatch/activitywatch")
          //i.fa.fa-github
          | GitHub
        a.outlinks(href="https://twitter.com/ActivityWatchIt")
          //i.fa.fa-twitter
          | Twitter
      div
        | Something not working as it should?
        a(href="https://github.com/ActivityWatch/activitywatch-user-issues/issues/new")
          |  File an issue.
</template>

<script>
import Usermenu from './components/Usermenu.vue';

// TODO: Highlight active item in menubar

export default {
  components: {
    Usermenu,
  },

  props: {
  },

  data: function() {
    return {
      menuEntries: [
        { label: "Home",
          path: "/",
          exact: true,
          iconCssClass: "glyphicon glyphicon-home" },
        { label: "Activity",
          path: "/activity",
          iconCssClass: "glyphicon glyphicon-time" },
        { label: "Buckets",
          path: "/buckets",
          iconCssClass: "glyphicon glyphicon-folder-open" },
        { label: "Server Log",
          path: "/log",
          iconCssClass: "glyphicon glyphicon-list-alt" }
      ]
    }
  },
}
</script>

<style lang="scss">
$bgcolor: #FFF;
$textcolor: #000;

body {
  color: $textcolor;
  font-family: 'Varela Round', sans-serif;
  background-color: #EEE;
}

.outlinks {
  margin-left: 0.5rem;
}

.aw-navbar {
    border: 0px solid #DDD;
    border-bottom-width: 1px;
    min-height: 20px;

    li > a {
        padding: 10px 15px 10px 15px;
        color: #555;
        font-size: 12pt;

        span {
            margin-right: 7px;
        }
    }
}


.header {
  border-bottom: 1px solid #CCC;
  height: 55px;
  line-height: 55px;
  font-family: 'Varela Round', sans-serif;
  font-size: 12pt;
  font-weight: 400;

  .title {
    display: inline-block;
    width: 200px;
    font-size: 20pt;
    width: 100%;
    color: #444;

    img {
        width: 1.2em;
        height: 1.2em;
    }
  }
}

.aw-container {
  background-color: #FFF;
  border: 1px solid #CCC;
  border-top: 0px;
  border-radius: 0px 0px 5px 5px;
}
</style>
