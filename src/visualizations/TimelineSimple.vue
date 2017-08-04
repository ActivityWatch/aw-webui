<template lang="pug">
div
  //| Event type: {{ event_type }}
  //br
  svg#timeline
</template>

<script>
import timeline_simple from './timeline-simple.js';

let coloring = {
    currentwindow: {
        key: "app"
    },
    afkstatus: {
        key: "status",
        colors: {"afk": "#CCC", "not-afk": "#0F4"}
    }
}

export default {
  name: "TimelineSimple",
  props: ['event_type', 'events'],
  mounted: function() {
      let el = document.getElementById("timeline");
      timeline_simple.create(el);
  },
  watch: {
      "events": function() {
          let el = document.getElementById("timeline");
          let options = {
            coloring: coloring[this.event_type] || {}
          }
          timeline_simple.update(el, this.events, options)
      }
  }
}
</script>
