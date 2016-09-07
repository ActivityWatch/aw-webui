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
let $CreateView  = Resources.$CreateView;

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
    var view_windowactivity_johandesktop = {"name": "Window activity", "type": "windowactivity", "host": "johan-desktop"};
    this.addView(view_windowactivity_johandesktop);
    console.log("test");
  }
}
</script>
