<template lang="pug">

div
  h3 {{ bucket.id }}
  table
    tr
      td Type:
      td {{ bucket.type }}
    tr
      td Client:
      td {{ bucket.client }}
    tr
      td Hostname:
      td {{ bucket.hostname }}
    tr
      td Created:
      td {{ bucket.created }}

  hr

  aw-sunburst(:events="events")

</template>

<style scoped lang="scss">
</style>

<script>
import moment from "moment";
import Resources from '../resources.js';

import Sunburst from '../visualizations/Sunburst.vue';

let $Bucket = Resources.$Bucket;
let $Event = Resources.$Event;

export default {
  name: "Bucket",
  components: {
    "aw-sunburst": Sunburst,
  },
  data: () => {
    return {
      bucket: Object,
      events: [],
      isListExpanded: false,
    }
  },
  methods: {
    getBucketInfo: function(bucket_id) {
      return $Bucket.get({"id": bucket_id}).then((response) => {
        return response.json();
      });
    },

    getEvents: function(bucket_id) {
      return $Event.get({"id": bucket_id}).then((response) => {
        return response.json();
      });
    },

    expandList: function() {
      this.isListExpanded = !this.isListExpanded;
      console.log("List should be expanding: ", this.isListExpanded);
    }
  },
  mounted: function() {
    // TODO: ONLY FOR TESTING
    let bucket_id_afk = "aw-watcher-afk-testing_erb-main2-arch";
    let bucket_id_window = "aw-watcher-window-testing_erb-main2-arch";

    var hierarchy = [];

    //this.getBucketInfo(bucket_id_afk).then((info) => {
    //    console.log(info);
    //});

    function buildHierarchy(events_afk, events_window) {
        let parents = events_afk;



    }

    this.getEvents(bucket_id_afk).then((events) => {
        console.log(events);

        // Build the root node
        return {
          "timestamp": _.first(events).timestamp,
          // TODO: This should be the time between the first and last events,
          //       not the durations summed.
          "duration": _.sum(_.map(events, (e) => e.duration)),
          "children": events
        }
    }).then((hierarchy) => {
        console.log(hierarchy);
        return this.getEvents(bucket_id_window).then((events) => {
            var i_child = 0;
            for(var i_parent = 0; i_parent < hierarchy.children.length; i_parent++) {
                let p = hierarchy.children[i_parent];
                let p_start = moment(p.timestamp);
                let p_end = p_start.clone().add(p.duration, "seconds");
                console.log(p_start.format());
                console.log(p_end.format());
                console.log(p_start.format());
                console.log(p.duration);

                // I have no idea why, but when I print them like
                // this they seem to be the same event...
                console.log(p_start, p_end);
                if(p_start === p_end) {
                    // Yet they aren't
                    console.warn("This should never happen")
                }

                p.children = [];
                while(i_child < events.length) {
                    var e = events[i_child];
                    var e_start = moment(e.timestamp);
                    var e_end = e_start.add(e.duration, "seconds");

                    let p1 = e_start.isAfter(p_start);
                    let p2 = p_end.isAfter(p_start);
                    let p3 = p_end.isAfter(e_end);
                    console.log(p1 + ": " + (e_start - p_start));
                    console.log(p2 + ": " + (e_start - e_end));
                    console.log(p3 + ": " + (p_end - e_end));

                    // TODO: This isn't correct, yet
                    if(p1 /*&& p2 && p3*/) {
                      console.log("Added relation: " + i_child);
                      p.children = _.concat(p.children, e);
                      i_child++;
                    } else {
                      console.log("Skipped: " + i_child);
                      i_child++;
                      break;
                    }
                }
            }
            console.log(hierarchy);
            return hierarchy;
        });
    }).then((hierarchy) => {
        //sunburst.update(el, hierarchy);
    });

    this.getBucketInfo(bucket_id_window).then((info) => {
        console.log(info);
    });

    // Build hierarchy

  },
}
</script>
