<template lang="jade">
div#wrapper
  div.header
    div.container
      span.title
        img(src="/static/logo.png")
        span(style="padding-left: 15px;")
          | ActivityWatch
      span.status
        span.good(v-show="connected")
          span.glyphicon.glyphicon-ok-circle
          span.text
            | Connected
        span.bad(v-show="!connected")
          span.glyphicon.glyphicon-alert
          span.text
            | Not connected

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

  div.container(style="margin-top: 1rem; margin-bottom: 1rem; color: #555")
    | Made with ❤ by the
    a(href="http://activitywatch.net/contributors/")
      | ActivityWatch developers

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
        a(href="https://github.com/ActivityWatch/activitywatch/issues/new")
          |  File an issue.
</template>

<script>
import Usermenu from './components/Usermenu.vue';
import Views from './components/Views.vue';

import Resources from './resources.js';

var show_hide = require('./util/show_hide.js').show_hide;

let $Info = Resources.$Info;

// TODO: Highlight active item in menubar

export default {
  components: {
    Usermenu,
    Views
  },

  data: function() {
    return {
      views: Views,
      connected: false
    }
  },

  methods: {
    show_hide: show_hide,
  },

  ready() {
    console.info("Ready!");

    $Info.get().then(
        (response) => {
            if (response.status > 304) {
                console.error("Status code from return call was >304");
            } else {
                this.$set("connected", true);
            }
        },
        (response) => {
            console.log("a");
            this.$set("connected", false);
        });
  }
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
    color: #444;
    white-space: nowrap;

    img {
        width: 1.2em;
        height: 1.2em;
    }
  }

  .status {
    float: right;

    .text {
        margin-left: 1em;
    }

    .good {
        color: green;
    }

    .bad {
        color: red;
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
