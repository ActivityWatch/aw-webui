<template lang="pug">

b-nav-item-dropdown
  template(slot="button-content")
    icon(name="clock-o")
    | Activity
  b-dropdown-item(v-if="hosts.length<=0", disabled)
    | No activity reports available
  b-dropdown-item(v-for="host in hosts", :key="host", :to="'/activity/' + host")
    | {{ host }}


</template>

<script>

import Resources from '../resources.js';

import 'vue-awesome/icons/clock-o'

let $Bucket     = Resources.$Bucket;

export default {
  data () {
    return {
      hosts: [],
    }
  },
  mounted: function() {
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
  }
}
</script>

<style lang="scss">
</style>
