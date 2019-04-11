<template lang="pug">
div#wrapper
  aw-header

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
      span.mt-2(v-show="info", style="color: #888; font-size: 0.8em")
        | Host: {{info.hostname}}
        br
        | Version: {{info.version}}
</template>

<script>

// only import the icons you use to reduce bundle size
import 'vue-awesome/icons/database';
import 'vue-awesome/icons/check-circle';
import 'vue-awesome/icons/times-circle';
import 'vue-awesome/icons/bars';
import 'vue-awesome/icons/clock';
import 'vue-awesome/icons/calendar';
import 'vue-awesome/icons/brands/twitter';
import 'vue-awesome/icons/brands/github';
import 'vue-awesome/icons/search';
import 'vue-awesome/icons/stopwatch';
import 'vue-awesome/icons/cog';
import 'vue-awesome/icons/mobile';
import 'vue-awesome/icons/desktop';

import _ from 'lodash';

// Set this to true to test Android behavior when on a desktop
let testingAndroid = false;

export default {
  data: function() {
    return {
      activityViews: [],
      info: {},
      isAndroidApp: testingAndroid || navigator.userAgent.includes("Android") && navigator.userAgent.includes("wv"), // Checks for Android and WebView
    }
  },

  mounted: async function() {
    this.$aw.getInfo().then(
      (info) => {
        this.info = info;
      },
      (e) => {
        console.error("Unable to connect:", e)
        this.info = {};
      }
    );
  }
}

</script>

<style lang="scss">
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

.aw-container {
  background-color: #FFF;
  border: 1px solid #CCC;
  border-top: 0;
}

.rounded-bottom {
  border-radius: 0px 0px 5px 5px;
}

.nav-link {
  color: #000;
}

</style>
