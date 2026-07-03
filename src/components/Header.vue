<template lang="pug">
div(:class="{'fixed-top-padding': fixedTopMenu}")
  b-navbar.aw-navbar(toggleable="lg" :fixed="fixedTopMenu ? 'top' : null")
    // Brand on mobile
    b-navbar-nav.d-block.d-lg-none
      b-navbar-brand(to="/" style="background-color: transparent;")
        img.aligh-middle(src="/logo.png" style="height: 1.5em;")
        span.ml-2.align-middle(style="font-size: 1em; color: #000;") {{ $t('app.name') }}

    b-navbar-toggle(target="nav-collapse")

    b-collapse#nav-collapse(is-nav)
      b-navbar-nav
        // If only a single view (the default) is available
        b-nav-item(v-if="activityViews && activityViews.length === 1", v-for="view in activityViews", :key="view.name", :to="view.pathUrl")
          div.px-2.px-lg-1
            icon(name="calendar-day")
            | {{ $t('nav.activity') }}

        // If multiple (or no) activity views are available
        b-nav-item-dropdown(v-if="!activityViews || activityViews.length !== 1")
          template(slot="button-content")
            div.d-inline.px-2.px-lg-1
              icon(name="calendar-day")
              | {{ $t('nav.activity') }}
          b-dropdown-item(v-if="activityViews === null", disabled)
            span.text-muted {{ $t('nav.loading') }}
            br
          b-dropdown-item(v-else-if="activityViews && activityViews.length <= 0", disabled)
            | {{ $t('nav.noActivityReports') }}
          b-dropdown-item(v-for="view in activityViews", :key="view.name", :to="view.pathUrl")
            icon(:name="view.icon")
            | {{ view.name }}

        b-nav-item(to="/timeline" style="font-color: #000;")
          div.px-2.px-lg-1
            icon(name="stream")
            | {{ $t('nav.timeline') }}

        b-nav-item(to="/stopwatch")
          div.px-2.px-lg-1
            icon(name="stopwatch")
            | {{ $t('nav.stopwatch') }}

      // Brand on large screens (centered)
      b-navbar-nav.abs-center.d-none.d-lg-block
        b-navbar-brand(to="/" style="background-color: transparent;")
          img.ml-0.aligh-middle(src="/logo.png" style="height: 1.5em;")
          span.ml-2.align-middle(style="font-size: 1.0em; color: #000;") {{ $t('app.name') }}

      b-navbar-nav.ml-auto
        b-nav-item-dropdown
          template(slot="button-content")
            div.d-inline.px-2.px-lg-1
              icon(name="tools")
              | {{ $t('nav.tools') }}
          b-dropdown-item(to="/search")
            icon(name="search")
            | {{ $t('nav.search') }}
          b-dropdown-item(to="/work-report")
            icon(name="briefcase")
            | {{ $t('nav.workReport') }}
          b-dropdown-item(to="/trends" v-if="devmode")
            icon(name="chart-line")
            | {{ $t('nav.trends') }}
          b-dropdown-item(to="/report" v-if="devmode")
            icon(name="chart-pie")
            | {{ $t('nav.report') }}
          b-dropdown-item(to="/alerts" v-if="devmode")
            icon(name="flag-checkered")
            | {{ $t('nav.alerts') }}
          b-dropdown-item(to="/timespiral" v-if="devmode")
            icon(name="history")
            | {{ $t('nav.timespiral') }}
          b-dropdown-item(to="/query")
            icon(name="code")
            | {{ $t('nav.query') }}
          b-dropdown-item(to="/graph" v-if="devmode")
            icon(name="project-diagram")
            | {{ $t('nav.graph') }}

        b-nav-item(to="/buckets")
          div.px-2.px-lg-1
            icon(name="database")
            | {{ $t('nav.rawData') }}
        b-nav-item(to="/settings")
          div.px-2.px-lg-1
            icon(name="cog")
            | {{ $t('nav.settings') }}
</template>

<style lang="scss" scoped>
.fixed-top-padding {
  padding-bottom: 3.5em;
}
</style>

<script lang="ts">
// only import the icons you use to reduce bundle size
import 'vue-awesome/icons/calendar-day';
import 'vue-awesome/icons/briefcase';
import 'vue-awesome/icons/calendar-week';
import 'vue-awesome/icons/stream';
import 'vue-awesome/icons/database';
import 'vue-awesome/icons/search';
import 'vue-awesome/icons/code';
import 'vue-awesome/icons/chart-line';
import 'vue-awesome/icons/chart-pie';
import 'vue-awesome/icons/flag-checkered';
import 'vue-awesome/icons/stopwatch';
import 'vue-awesome/icons/cog';
import 'vue-awesome/icons/tools';
import 'vue-awesome/icons/history';
import 'vue-awesome/icons/project-diagram';
import 'vue-awesome/icons/ellipsis-h';
import 'vue-awesome/icons/mobile';
import 'vue-awesome/icons/desktop';

import _ from 'lodash';

import { mapState } from 'pinia';
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';
import { IBucket } from '~/util/interfaces';

export default {
  name: 'Header',
  data() {
    return {
      activityViews: null,
      fixedTopMenu: this.$isAndroid,
    };
  },
  computed: {
    ...mapState(useSettingsStore, ['devmode']),
  },
  mounted: async function () {
    const bucketStore = useBucketsStore();
    await bucketStore.ensureLoaded();
    const buckets: IBucket[] = bucketStore.buckets;
    const types_by_host = {};

    const activityViews = [];

    _.each(buckets, v => {
      types_by_host[v.hostname] = types_by_host[v.hostname] || {};
      types_by_host[v.hostname].afk ||= v.type == 'afkstatus';
      types_by_host[v.hostname].window ||= v.type == 'currentwindow';
      types_by_host[v.hostname].android ||= v.type == 'currentwindow' && v.id.includes('android');
    });

    _.each(types_by_host, (types, hostname) => {
      if (types['android']) {
        activityViews.push({
          name: `${hostname} (Android)`,
          hostname: hostname,
          type: 'android',
          pathUrl: `/activity/${hostname}`,
          icon: 'mobile',
        });
      } else if (hostname != 'unknown') {
        activityViews.push({
          name: hostname,
          hostname: hostname,
          type: 'default',
          pathUrl: `/activity/${hostname}`,
          icon: 'desktop',
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
.nav-item {
  .nav-link {
    color: #555 !important;
  }
}
</style>
