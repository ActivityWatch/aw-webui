<template lang="pug">
div#wrapper
  div.header(v-show="!isAndroidApp")
    div.container
      span.title
        img.ml-0(src="/static/logo.png")
        span.ml-2
          | ActivityWatch
      span.status
        span.good(v-show="connected")
          | Connected
          icon(name="check-circle")
        span.bad(v-show="!connected")
          | Not connected
          icon(name="times-circle")

  div.container.aw-container
    // TODO: Refactor into Mainmenu component
    b-nav.row.aw-navbar
      b-nav-item(to="/" exact)
        icon(name="home")
        | Home
      // If only a single view (the default) is available
      b-nav-item(v-if="activityViews.length === 1", v-for="view in activityViews", :key="view.name", :to="view.pathUrl + '/' + view.hostname")
        icon(name="clock")
        | Activity
      // If multiple activity views are available
      b-nav-item-dropdown(v-if="activityViews.length !== 1")
        template(slot="button-content")
          icon(name="clock")
          | Activity
        b-dropdown-item(v-if="activityViews.length <= 0", disabled)
          | No activity reports available
          br
          small Make sure you have both an AFK and window watcher running
        b-dropdown-item(v-for="view in activityViews", :key="view.name", :to="view.pathUrl + '/' + view.hostname")
          icon(:name="view.icon")
          | {{ view.name }}
      b-nav-item(to="/timeline")
        icon(name="calendar")
        | Timeline
      b-nav-item(to="/stopwatch")
        icon(name="stopwatch")
        | Stopwatch
      b-nav-item(to="/buckets")
        icon(name="database")
        | Raw Data
      b-nav-item(to="/query")
        icon(name="search")
        | Query

  div.container.aw-container.rounded-bottom.pt-3.pd-3
    error-boundary
      router-view

  div.container.mt-3.mb-3(style="color: #555")
    div(style="float: left")
      div.mb-1
        | Made with ❤ by the #[a(href="http://activitywatch.net/contributors/") ActivityWatch developers]
      div
        a.mr-2(href="https://github.com/ActivityWatch/activitywatch", target="_blank")
          icon(name="brands/github")
          | GitHub
        a(href="https://twitter.com/ActivityWatchIt", target="_blank")
          icon(name="brands/twitter")
          | Twitter

    div(style="float: right; text-align: right;")
      | Found a bug? #[a(href="https://github.com/ActivityWatch/activitywatch/issues/new") File an issue]
      br
      | Need help? #[a(href="https://forum.activitywatch.net/c/support") Ask on the forum]
      br
      | Missing a feature? #[a(href="https://forum.activitywatch.net/c/features") Vote on the forum]
      br
      | Built something cool? #[a(href="https://forum.activitywatch.net/c/projects") Share it on the forum]
      br
      span.mt-2(v-show="connected", style="color: #888; font-size: 0.8em")
        | Host: {{info.hostname}}
        br
        | Version: {{info.version}}
</template>

<script>

// only import the icons you use to reduce bundle size
import 'vue-awesome/icons/home';
import 'vue-awesome/icons/database';
import 'vue-awesome/icons/check-circle';
import 'vue-awesome/icons/times-circle';
import 'vue-awesome/icons/clock';
import 'vue-awesome/icons/calendar';
import 'vue-awesome/icons/brands/twitter';
import 'vue-awesome/icons/brands/github';
import 'vue-awesome/icons/search';
import 'vue-awesome/icons/stopwatch';
import 'vue-awesome/icons/mobile';
import 'vue-awesome/icons/desktop';

import _ from 'lodash';

// Set this to true to test Android behavior when on a desktop
let testingAndroid = false;

export default {
  data: function() {
    return {
      activityViews: [],
      connected: false,
      info: {},
      isAndroidApp: testingAndroid || navigator.userAgent.includes("Android") && navigator.userAgent.includes("wv"), // Checks for Android and WebView
    }
  },

  mounted: async function() {
    this.$aw.getInfo().then(
      (info) => {
        this.connected = true;
        this.info = info;
      },
      (e) => {
        console.error("Unable to connect:", e)
        this.connected = false;
        this.info = {};
      }
    );

    let buckets = await this.$aw.getBuckets();
    let types_by_host = {};
    _.each(buckets, (v) => {
        types_by_host[v.hostname] = types_by_host[v.hostname] || {};
        // The '&& true;' is just to typecoerce into booleans
        types_by_host[v.hostname].afk |= v.type == "afkstatus";
        types_by_host[v.hostname].window |= v.type == "currentwindow";
        types_by_host[v.hostname].android |= v.type == "currentwindow" && this.isAndroidApp;  // Use other bucket type ID in the future
    })
    console.log(types_by_host);

    _.each(types_by_host, (types, hostname) => {
        if(types.afk && types.window) {
          this.activityViews.push({
            name: hostname,
            hostname: hostname,
            type: "default",
            pathUrl: '/activity',
            icon: 'desktop'
          });
        }
        if(types.android) {
          this.activityViews.push({
            name: `${hostname} (Android)`,
            hostname: hostname,
            type: "android",
            pathUrl: '/activity-android',
            icon: 'mobile'
          });
        }
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

.aw-navbar {
    li > a {
        padding: 10px 15px 10px 15px;
        color: #555;
        font-size: 12pt;

        span {
            margin-right: 7px;
        }
    }

  .active {
    background-color: #EEE;
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
</style>
