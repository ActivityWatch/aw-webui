<template lang="jade">

// Trying to get it to work with bootstrap, doesn't even show up...
dropdown(text="Action")
  button(slot="button", type="button").btn.btn-default.dropdown-toggle Action
    span.caret
  ul(slot="dropdown-menu").dropdown-menu
    li
      a(href="#dropdown") Action
    li
      a(href="#dropdown") Another action

// Fallback version
div#views
  div(v-for="host in hosts")
    a(v-link="'/activity/'+host")
      span.glyphicon.glyphicon-signal(aria-hidden="true")
      |  {{ host }}

</template>

<script>

import Resources from '../resources.js';

var dropdown = require('vue-strap').dropdown;

let $Bucket     = Resources.$Bucket;

export default {
  components: {
    'dropdown': dropdown,
  },
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
  methods: {
    test: function(){
      var viewdiv = document.getElementById("views");
      if (this.visible)
        viewdiv.style.height = "100px";
      else
        viewdiv.style.height = "150px";
    }
  }
}
</script>

<style lang="scss" scoped>
#views {
  position: absolute;
  width: 100%;
}
</style>
