<template lang="jade">

// Fallback version
div#views-container
  nav.row.navbar.aw-navbar
    ul.nav.navbar-nav
      li(v-for="host in hosts", :key="host")
        a(v-link="'/activity/'+host")
          span.glyphicon.glyphicon-signal(aria-hidden="true")
          |  {{ host }}

  accordion(:one-at-atime="false")
    panel(v-for="host in hosts", :key="host", :header="host", :is-open="true")
      router-link(to="'activity/'+host")
        button.btn.btn-default.btn-sm(type="button")
          span.glyphicon.glyphicon-folder-open(aria-hidden="true")
          |  View
</template>

<script>

import Resources from '../resources.js';

let $Bucket     = Resources.$Bucket;

export default {
  data () {
    return {
      hosts: [],
    }
  },
  ready: function() {
    $Bucket.get().then((response) => {
      var buckets = response.json();
      // Sort buckettypes by hostname
      var btypes_by_host = {}
      for (var bucketname in buckets){
        var bucket = buckets[bucketname];
        var bhost = bucket["hostname"];
        var btype = bucket["type"];
        // Add bhost obj if it doesn't exist
        if (!(bhost in btypes_by_host))
          btypes_by_host[bhost] = {}
        // Add bucket
        btypes_by_host[bhost][btype] += [bucket];
      }
      // Add views that have their required buckets
      for (var hostname in btypes_by_host){
        // Window activity view (Will be available if a host has afkstatus and currentwindow)
        if (("afkstatus" in btypes_by_host[hostname]) && ("currentwindow" in btypes_by_host[hostname])){
          this.hosts.push(hostname);
        }
      }
    });
  },
}
</script>

<style lang="scss">
</style>
