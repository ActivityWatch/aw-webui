<template lang="pug">
div#wrapper
  div.header
    div.container
      span.title
        img(src="/static/logo.png")
        span(style="padding-left: 15px;")
          | ActivityWatch
      span.status
        span.good(v-show="connected")
          | Connected
          icon(name="check-circle")
        span.bad(v-show="!connected")
          span.text
            | Not connected
            icon(name="times-circle")

  div.container.aw-container
    // TODO: Refactor into Mainmenu component
    b-nav.row.aw-navbar
      b-nav-item(to="/")
        icon(name="home")
        | Home
      b-nav-item(v-if="activity_hosts.length === 1", v-for="host in activity_hosts", :key="host", :to="'/activity/' + host")
        icon(name="clock-o")
        | Activity
      b-nav-item-dropdown(v-if="activity_hosts.length !== 1")
        template(slot="button-content")
          icon(name="clock-o")
          | Activity
        b-dropdown-item(v-if="activity_hosts.length <= 0", disabled)
          | No activity reports available
          br
          small Make sure you have both an afk and window watcher running
        b-dropdown-item(v-for="host in activity_hosts", :key="host", :to="'/activity/' + host")
          | {{ host }}
      b-nav-item(to="/buckets")
        icon(name="database")
        | Raw Data
      //li
        router-link(to="/log")
          // TODO: Add icon
          | Server Log

  div.container.aw-container.rounded-bottom#content
      router-view

  div.container(style="height: 4rem; margin-top: 1rem; margin-bottom: 1rem; color: #555")
    div(style="float: left")
      div
        | Made with ❤ by the #[a(href="http://activitywatch.net/contributors/") ActivityWatch developers]
      div
        a.outlinks(href="https://github.com/ActivityWatch/activitywatch", target="_blank")
          img(title="GitHub", src="https://img.shields.io/github/stars/ActivityWatch/activitywatch.svg?style=social&label=Star")
        a.outlinks(href="https://twitter.com/ActivityWatchIt", target="_blank")
          img(title="Twitter", src="https://img.shields.io/twitter/follow/ActivityWatchIt.svg?style=social&label=Follow")

    div(style="float: right; text-align: right;")
      | Need help? #[a(href="https://forum.activitywatch.net") Ask on the forum]
      br
      | Found a bug? #[a(href="https://github.com/ActivityWatch/activitywatch/issues/new") File an issue]
</template>

<script>

// only import the icons you use to reduce bundle size
import 'vue-awesome/icons/home';
import 'vue-awesome/icons/database';
import 'vue-awesome/icons/check-circle';
import 'vue-awesome/icons/times-circle';
import 'vue-awesome/icons/clock-o';
import 'vue-awesome/icons/twitter'
import 'vue-awesome/icons/github'


import Resources from './resources.js';


let $Info = Resources.$Info;
let $Bucket = Resources.$Bucket;

// TODO: Highlight active item in menubar

export default {
  data: function() {
    return {
      activity_hosts: [],
      connected: false,
    }
  },

  mounted: function() {
    $Info.get().then(
      (response) => {
        if (response.status > 304) {
          console.error("Status code from return call was >304");
        } else {
          this.connected = true;
        }
      },
      (response) => {
        this.connected = false;
      }
    );

    $Bucket.get().then((response) => {
        let buckets = response.json();
        let types_by_host = {};
        _.each(buckets, (v, k) => {
            types_by_host[v.hostname] = types_by_host[v.hostname] || {};
            if(v.type == "afkstatus") {
                types_by_host[v.hostname].afk = true;
            } else if(v.type == "currentwindow") {
                types_by_host[v.hostname].window = true;
            }
        })

        _.each(types_by_host, (types, hostname) => {
            if(types.afk === true && types.window === true) {
                this.activity_hosts.push(hostname);
            }
        })
    })
  }
}

</script>

<style lang="scss">
$bgcolor: #FFF;
$textcolor: #000;

html, body, button {
  color: $textcolor;
  font-family: 'Varela Round', sans-serif !important;
}

body {
  background-color: #EEE;
}

.fa-icon {
  margin-top: -0.125em;
  margin-left: 4px;
  margin-right: 4px;
  vertical-align: middle;
}

.outlinks {
  img {
    margin: 0.5rem 0.5rem 0.5rem 0;
    height: 1.5rem;
  }
}

.aw-navbar {
    li > a {
        padding: 10px 15px 10px 15px;
        color: #555;
        font-size: 12pt;

        span {
            margin-right: 7px;
        }
    }
}

.nav-item:hover {
  background-color: #DDD;
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
}

.rounded-bottom {
  border-radius: 0px 0px 5px 5px;
}

#content {
  padding-top: 2em;
}
</style>
