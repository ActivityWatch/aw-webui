<template lang="pug">
div.aw-container
  b-nav.aw-navbar.navbar-expand-md
    b-navbar-nav
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
      b-nav-item(to="/timeline" style="font-color: #000;")
        icon(name="calendar")
        | Timeline
      b-nav-item(to="/stopwatch")
        icon(name="stopwatch")
        | Stopwatch
    b-navbar-nav.abs-center
      b-navbar-brand(to="/" style="background-color: transparent;")
        img.ml-0.aligh-middle(src="/static/logo.png" style="height: 1.5em;")
        span.ml-2.align-middle(style="font-size: 1.0em; color: #000;") ActivityWatch
    b-navbar-nav.ml-auto
      b-nav-item(to="/query")
        icon(name="search")
        | Query
      b-nav-item(to="/buckets")
        icon(name="database")
        | Raw Data
      b-nav-item(to="/settings")
        icon(name="cog")
        | Settings
</template>

<script>
export default {
  name: 'Header',
  data() {
    return { activityViews: [] };
  },
  mounted: async function() {
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
<style scoped>

.aw-navbar {
  .active {
    background-color: #DDD;
    border-radius: 0.5em;
  }

  border-radius: 0.5em;

  padding: 0.5em;
}

.nav-item {
  display: flex;
  align-items: center;

  margin-left: 0.2em;
  margin-right: 0.2em;
  border-radius: 0.5em;
}

.nav-item:hover {
  background-color: #DDD;
}

.abs-center {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
}

</style>
