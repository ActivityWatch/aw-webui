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
        li
          a(v-link="{ path: '/', exact: true }")
            span.glyphicon.glyphicon-home
            | Home
        li
          a(v-on:click="show_hide('views')", style="cursor:pointer;").dropdown-btn
            span.glyphicon.glyphicon-time
            | Activity
        li
          a(v-link="{ path: '/buckets' }")
            span.glyphicon.glyphicon-folder-open
            | Buckets
        li
          a(v-link="{ path: '/log' }")
            span.glyphicon.glyphicon-list-alt
            | Server Log
    div.dropdown-content#views
      Views
    div#content
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
import Views from './components/Views.vue';
var show_hide = require('./util/show_hide.js').show_hide;

// TODO: Highlight active item in menubar

export default {
  components: {
    Usermenu,
    Views
  },

  data: function() {
    return {
      views: Views
    }
  },
  methods: {
    show_hide: show_hide,
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
    margin-bottom: 0;

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
  border-top: 0;
  border-radius: 0px 0px 5px 5px;
}

#content {
    padding-top: 20px;
}
</style>
