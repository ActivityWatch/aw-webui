<template lang="jade">
h2 Views

hr

accordion(:one-at-atime="false")
  panel(v-for="host in hosts", :header="host", :is-open="true")
    a(v-link="'activity/'+host")
      button.btn.btn-default.btn-sm(type="button")
        span.glyphicon.glyphicon-folder-open(aria-hidden="true")
        |  View


</template>

<style lang="scss">

</style>

<script>
import Resources from '../resources.js';

var panel = require('vue-strap').panel;
var accordion = require('vue-strap').accordion;

let $EventChunk = Resources.$EventChunk;
let $QueryView  = Resources.$QueryView;
let $CreateView = Resources.$CreateView;
let $Bucket     = Resources.$Bucket;

export default {
  name: "Views",
  components: {
    'panel': panel,
    'accordion': accordion
  },
  data: () => {
    return {
      hosts: [],
    }
  },
  methods: {
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
          var view_windowactivity = {"name": "Window activity", "type": "windowactivity", "host": hostname};
          this.hosts.push(hostname);
        }
      }
    });
  }
}
</script>
