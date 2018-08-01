<template lang="pug">
v-app
  v-toolbar
    //v-toolbar-side-icon
    v-toolbar-title.pr-3
      img(src="/static/logo.png" style="height: 1.5em; vertical-align: middle; margin-right: 0.5em; margin-top: -0.2em")
      | ActivityWatch
    v-toolbar-items
      v-btn(flat)
        span.status
          span(v-show="connected" v-bind:style="{ color: connected ? '#0A0' : '#A00' }")
            span(v-show="connected")
              | Connected
              icon(name="check-circle")
            span(v-show="!connected")
              | Not connected
              icon(name="times-circle")
    v-spacer
    v-toolbar-items.hidden-sm-and-down
      v-btn(flat to="/")
        icon(name="home")
        | Home
      v-btn(flat v-if="activity_hosts.length === 1", v-for="host in activity_hosts", :key="host", :to="'/activity/' + host")
        icon(name="clock")
        | Activity
      v-menu(v-if="activity_hosts.length !== 1")
        v-btn(flat slot="activator")
          icon(name="clock")
          | Activity
        v-list
          v-list-tile(v-if="activity_hosts.length <= 0", disabled)
            v-list-tile-title
              | No activity reports available
              br
              small Make sure you have both an afk and window watcher running
          v-list-tile(v-for="host in activity_hosts", :key="host", :to="'/activity/' + host")
            v-list-tile-title
              | {{ host }}
      v-btn(flat to="/buckets")
        icon(name="database")
        | Raw Data
      v-btn(flat to="/query")
        // TODO: Use 'searchengin' icon instead, when landed in vue-awesome
        icon(name="search")
        | Query

  v-container
    router-view

  v-footer(dark height="auto")
    v-layout(justify-center row wrap)
      v-card.white--text.text-xs-center(flat tile width="100%")
        v-card-text.white--text
          v-btn.white--text.mx-2(icon href="https://github.com/ActivityWatch/activitywatch" target="_blank")
            icon(height="48px" width="48px" name="brands/github")
          v-btn.white--text.mx-2(icon href="https://twitter.com/ActivityWatchIt" target="_blank")
            icon(height="48px" width="48px" name="brands/twitter")

          v-layout(justify-center row wrap)
            div.text-xs-right(style="border-right: 1px solid black; margin-right: 1em; padding-right: 1em")
              | Need help? #[a(href="https://forum.activitywatch.net") Ask on the forum]
              br
              | Found a bug? #[a(href="https://github.com/ActivityWatch/activitywatch/issues/new") File an issue]
            div.text-xs-left.yellow-darken-3--text(v-show="connected")
              | Host: {{info.hostname}}
              br
              | Version: {{info.version}}
        v-divider
        v-card-text.white--text
          | Made with #[span(style="color: #F44; font-size: 1.5em; vertical-align: middle") ❤] by the #[a(href="http://activitywatch.net/contributors/") ActivityWatch developers]
</template>

<script>

// only import the icons you use to reduce bundle size
import 'vue-awesome/icons/home';
import 'vue-awesome/icons/database';
import 'vue-awesome/icons/check-circle';
import 'vue-awesome/icons/times-circle';
import 'vue-awesome/icons/clock';
import 'vue-awesome/icons/brands/twitter';
import 'vue-awesome/icons/brands/github';
import 'vue-awesome/icons/search';

import awclient from './awclient.js';

// TODO: Highlight active item in menubar

export default {
  data: function() {
    return {
      activity_hosts: [],
      connected: false,
      info: {}
    }
  },

  mounted: function() {
    awclient.info().then(
      (response) => {
        if (response.status > 304) {
          console.error("Status code from return call was >304");
        } else {
          this.connected = true;
          this.info = response.data;
        }
      },
      (response) => {
        this.connected = false;
        this.info = {};
      }
    );

    awclient.getBuckets().then((response) => {
        let buckets = response.data;
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

html,
body,
button {
  color: $textcolor;
  //font-family: 'Varela Round', sans-serif !important;
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
</style>
