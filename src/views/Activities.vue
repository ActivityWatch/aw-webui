<template lang="jade">
h1(style="color: red;") (IN DEVELOPMENT)
h2 Views

hr

div(v-for="view in views")
  h3(v-link="{ path: 'activity/'+view.type+'/'+view.host}") {{ view.name }} @ {{ view.host }}

</template>

<style lang="scss">

</style>

<script>
import Resources from '../resources.js';

let $EventChunk = Resources.$EventChunk;
let $QueryView  = Resources.$QueryView;
let $CreateView = Resources.$CreateView;
let $Bucket     = Resources.$Bucket;

export default {
  name: "Views",
  data: () => {
    return {
      views: [],
    }
  },
  methods: {
    addView: function(view){
      view["link"] = view["type"] + "/" + view["host"];
      this.views.push(view);
    }
  },
  ready: function() {
    $Bucket.get().then((response) => {
      var buckets = response.json();
      // {"host": {"buckettype": "bucketname"}}
      var btypes_by_host = {}
      for (var bucketname in buckets){
        var bucket = buckets[bucketname];
        var bhost = bucket["hostname"];
        var btype = bucket["type"];
        if (!(bhost in btypes_by_host))
          btypes_by_host[bhost] = {}
        if (bucket[btype] in btypes_by_host[bhost])
          btypes_by_host[bhost][btype] += [bucket];
        else
          btypes_by_host[bhost][btype] = [bucket];
      }
      // Do actual query and structure data for view
      for (var hostname in btypes_by_host){
        // Window activity view
        if (("afkstatus" in btypes_by_host[hostname]) && ("currentwindow" in btypes_by_host[hostname])){
          var view_windowactivity_summary = {"name": "Window activity summary", "type": "windowactivity_summary", "host": hostname};
          this.addView(view_windowactivity_summary);
          var view_windowactivity_timeline = {"name": "Window activity timeline", "type": "windowactivity_timeline", "host": hostname};
          this.addView(view_windowactivity_timeline);
        }
      }
    });
  }
}
</script>
