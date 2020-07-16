<template lang="pug">
div.aw-navbar
  b-navbar(toggleable="lg")
    // Brand on mobile
    b-navbar-nav.d-block.d-lg-none
      b-navbar-brand(to="/" style="background-color: transparent;")
        img.aligh-middle(src="/static/logo.png" style="height: 1.5em;")
        span.ml-2.align-middle(style="font-size: 1em; color: #000;") ActivityWatch

    b-navbar-toggle(target="nav-collapse")

    b-collapse#nav-collapse(is-nav)
      b-navbar-nav
        // If only a single view (the default) is available
        b-nav-item(v-if="activityViews.length === 1", v-for="view in activityViews", :key="view.name", :to="view.pathUrl")
          div.px-2.px-lg-1
            icon(name="calendar-day")
            | Activity

        // If multiple (or no) activity views are available
        b-nav-item-dropdown(v-if="activityViews.length !== 1")
          template(slot="button-content")
            div.d-inline.px-2.px-lg-1
              icon(name="calendar-day")
              | Activity
          b-dropdown-item(v-if="activityViews.length <= 0", disabled)
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
        b-nav-item(to="/query", active-class="aw-active")
          div.px-2.px-lg-1
            icon(name="search")
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

<script>
// only import the icons you use to reduce bundle size
import 'vue-awesome/icons/calendar-day';
import 'vue-awesome/icons/calendar-week';
import 'vue-awesome/icons/stream';
import 'vue-awesome/icons/database';
import 'vue-awesome/icons/search';
import 'vue-awesome/icons/stopwatch';
import 'vue-awesome/icons/cog';

import 'vue-awesome/icons/mobile';
import 'vue-awesome/icons/desktop';

import _ from 'lodash';

export default {
  name: 'Header',
  data() {
    return {
      activityViews: [],
    };
  },
  mounted: async function () {
    const buckets = await this.$aw.getBuckets();
    const types_by_host = {};

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
        this.activityViews.push({
          name: hostname,
          hostname: hostname,
          type: 'default',
          pathUrl: `/activity/${hostname}`,
          icon: 'desktop',
        });
      }
      if (types.android) {
        this.activityViews.push({
          name: `${hostname} (Android)`,
          hostname: hostname,
          type: 'android',
          pathUrl: `/activity/${hostname}`,
          icon: 'mobile',
        });
      }
    });
  },
};
</script>

<style lang="scss" scoped>
.aw-navbar {
  background-color: #fff;
  border: solid #ccc;
  border-width: 0 0 1px 0;
}

.active {
  background-color: #ddd;
  border-radius: 0.5em;
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
