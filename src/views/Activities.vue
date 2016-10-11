<template lang="jade">
h1(style="color: red;") (IN DEVELOPMENT)
h2 Views

hr

div(v-for="view in views")
  h4(v-link="{ path: 'activity/'+view.type+'/'+view.host}") {{ view.name }}
  p @{{view.host}}

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
      if (view["type"] == "windowactivity"){
        view["link"] = view["type"] + "/" + view["host"];
        this.views.push(view);
      }
    }
  },
  ready: function() {
    $Bucket.get().then((response) => {
      var buckets = response.json();
      // {"host": {"buckettype": "bucketname"}}
      var btypes = {}
      console.log(buckets);
      for (var bucketname in buckets){
        var bucket = buckets[bucketname];
        var bhost = bucket["hostname"];
        var btype = bucket["type"];
        if (!(bhost in btypes))
          btypes[bhost] = {}
        if (bucket[btype] in btypes[bhost])
          btypes[bhost][btype] += [bucket];
        else
          btypes[bhost][btype] = [bucket];
      }
      console.log(btypes);
      // Do actual query and structure data for view
      console.log(btypes);
      for (var hostname in btypes){
        // Window activity view
        if (("afkstatus" in btypes[hostname]) && ("currentwindow" in btypes[hostname])){
          var view_windowactivity = {"name": "Window activity", "type": "windowactivity", "host": hostname};
          this.addView(view_windowactivity);
        }
        /*
        for (var btype in btypes[hostname]){
          console.log(hostname + " - " + btype);
        }
        */
      }
    });
  }
}
</script>
