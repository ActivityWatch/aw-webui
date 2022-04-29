<template lang="pug">
div(:class="{'fixed-top-padding': fixedTopMenu}")
  b-navbar.aw-navbar(toggleable="lg" :fixed="fixedTopMenu ? 'top' : null")
    // Brand on mobile
    b-navbar-nav.d-block.d-lg-none
      b-navbar-brand(to="/" style="background-color: transparent;")
        img.aligh-middle(src="/static/logo.png" style="height: 1.5em;")
        span.ml-2.align-middle(style="font-size: 1em; color: #000;") ActivityWatch

    b-navbar-toggle(target="nav-collapse")

    b-collapse#nav-collapse(is-nav)
      b-navbar-nav
        // If only a single view (the default) is available
        b-nav-item(v-if="activityViews && activityViews.length === 1", v-for="view in activityViews", :key="view.name", :to="view.pathUrl")
          div.px-2.px-lg-1
            icon(name="calendar-day")
            | Activity

        // If multiple (or no) activity views are available
        b-nav-item-dropdown(v-if="!activityViews || activityViews.length !== 1")
          template(slot="button-content")
            div.d-inline.px-2.px-lg-1
              icon(name="calendar-day")
              | Activity
          b-dropdown-item(v-if="activityViews === null", disabled)
            span.text-muted Loading...
            br
          b-dropdown-item(v-else-if="activityViews && activityViews.length <= 0", disabled)
            | No activity reports available
            br
            small Make sure you have both an AFK and window watcher running
          b-dropdown-item(v-for="view in activityViews", :key="view.name", :to="view.pathUrl")
            icon(:name="view.icon")
            | {{ view.name }}

        b-nav-item(to="/timeline" style="font-color: #000;")
          div.px-2.px-lg-1
            icon(name="stream")
            | Timeline

        b-nav-item(to="/stopwatch")
          div.px-2.px-lg-1
            icon(name="stopwatch")
            | Stopwatch

      // Brand on large screens (centered)
      b-navbar-nav.abs-center.d-none.d-lg-block
        b-navbar-brand(to="/" style="background-color: transparent;")
          img.ml-0.aligh-middle(src="/static/logo.png" style="height: 1.5em;")
          span.ml-2.align-middle(style="font-size: 1.0em; color: #000;") ActivityWatch

      b-navbar-nav.ml-auto
        b-nav-item-dropdown
          template(slot="button-content")
            div.d-inline.px-2.px-lg-1
              icon(name="tools")
              | Tools
          b-dropdown-item(to="/search")
            icon(name="search")
            | Search
          b-dropdown-item(to="/trends" v-if="devmode")
            icon(name="chart-line")
            | Trends
          b-dropdown-item(to="/report" v-if="devmode")
            icon(name="chart-pie")
            | Report
          b-dropdown-item(to="/alerts" v-if="devmode")
            icon(name="flag-checkered")
            | Alerts
          b-dropdown-item(to="/query")
            icon(name="code")
            | Query

        b-nav-item(to="/buckets")
          div.px-2.px-lg-1
            icon(name="database")
            | Raw Data
        b-nav-item(to="/settings")
          div.px-2.px-lg-1
            icon(name="cog")
            | Settings
</template>

<style lang="scss" scoped>
.fixed-top-padding {
  padding-bottom: 3.5em;
}
</style>

<script>
// only import the icons you use to reduce bundle size
import 'vue-awesome/icons/calendar-day';
import 'vue-awesome/icons/calendar-week';
import 'vue-awesome/icons/stream';
import 'vue-awesome/icons/database';
import 'vue-awesome/icons/search';
import 'vue-awesome/icons/code';
import 'vue-awesome/icons/chart-line'; // TODO: switch to chart-column, when vue-awesome supports FA v6
import 'vue-awesome/icons/chart-pie';
import 'vue-awesome/icons/flag-checkered';
import 'vue-awesome/icons/stopwatch';
import 'vue-awesome/icons/cog';
import 'vue-awesome/icons/tools';

import 'vue-awesome/icons/ellipsis-h';

import 'vue-awesome/icons/mobile';
import 'vue-awesome/icons/desktop';

import _ from 'lodash';

import { mapState } from 'pinia';
import { useSettingsStore } from '~/stores/settings';

export default {
  name: 'Header',
  data() {
    return {
      activityViews: null,
      // Make configurable?
      fixedTopMenu: this.$isAndroid,
    };
  },
  computed: {
    ...mapState(useSettingsStore, ['devmode']),
  },
  mounted: async function () {
    await this.$store.dispatch('buckets/ensureBuckets');
    const buckets = this.$store.state.buckets.buckets;
    const types_by_host = {};

    const activityViews = [];

    // TODO: Change to use same bucket detection logic as get_buckets/set_available in store/modules/activity.ts
    _.each(buckets, v => {
      types_by_host[v.hostname] = types_by_host[v.hostname] || {};
      // The '&& true;' is just to typecoerce into booleans
      types_by_host[v.hostname].afk |= v.type == 'afkstatus';
      types_by_host[v.hostname].window |= v.type == 'currentwindow';
      types_by_host[v.hostname].android |= v.type == 'currentwindow' && v.id.includes('android'); // Use other bucket type ID in the future
    });
    //console.log(types_by_host);

    _.each(types_by_host, (types, hostname) => {
      if (hostname != 'unknown') {
        activityViews.push({
          name: hostname,
          hostname: hostname,
          type: 'default',
          pathUrl: `/activity/${hostname}`,
          icon: 'desktop',
        });
      }
      if (types.android) {
        activityViews.push({
          name: `${hostname} (Android)`,
          hostname: hostname,
          type: 'android',
          pathUrl: `/activity/${hostname}`,
          icon: 'mobile',
        });
      }
    });

    this.activityViews = activityViews;
  },
};
</script>

<style lang="scss" scoped>
@import '../style/globals';

.aw-navbar {
  background-color: white;
  border: solid $lightBorderColor;
  border-width: 0 0 1px 0;
}

.nav-item {
  align-items: center;

  margin-left: 0.2em;
  margin-right: 0.2em;
  border-radius: 0.5em;

  &:hover {
    background-color: #ddd;
  }
}

.abs-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}
</style>

<style lang="scss">
// Needed because dropdown somehow doesn't properly work with scoping
.nav-item {
  .nav-link {
    color: #555 !important;
  }
}
</style>
