<template lang="pug">

div
  h3 Today

  aw-sunburst(:hierarchy="hierarchy")

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
      hierarchy: Object,
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
    }
  },
  mounted: function() {
    // TODO: ONLY FOR TESTING
    let bucket_id_afk = "aw-watcher-afk-testing_erb-main2-arch";
    let bucket_id_window = "aw-watcher-window-testing_erb-main2-arch";

    function buildHierarchy(parents, children) {
        var i_child = 0;
        for(var i_parent = 0; i_parent < parents.length; i_parent++) {
            let p = parents[i_parent];
            let p_start = moment(p.timestamp);
            let p_end = p_start.clone().add(p.duration, "seconds");
            //console.log(p_start.format());
            //console.log(p_end.format());
            //console.log(p.duration);

            // I have no idea why, but when I print them like
            // this they seem to be the same event...
            /*
            console.log(p_start, p_end);
            if(p_start === p_end) {
                // Yet they aren't
                console.warn("This should never happen")
            }
            */

            p.children = [];
            while(i_child < children.length) {
                var e = children[i_child];
                var e_start = moment(e.timestamp);
                var e_end = e_start.add(e.duration, "seconds");

                let p1 = e_start.isAfter(p_start);
                //let p2 = p_end.isAfter(p_start);
                //let p3 = p_end.isAfter(e_end);
                //console.log(p1 + ": " + (e_start - p_start));
                //console.log(p2 + ": " + (e_start - e_end));
                //console.log(p3 + ": " + (p_end - e_end));

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

        // Build the root node
        return {
          "timestamp": _.first(parents).timestamp,
          // TODO: This should be the time between the first and last events,
          //       not the durations summed.
          "duration": _.sum(_.map(parents, (e) => e.duration)),
          "data": {"title": "ROOT"},
          "children": parents
        }

    }

    this.getEvents(bucket_id_afk).then((events_afk) => {
        console.log(events_afk);
        return this.getEvents(bucket_id_window).then((events_window) => {
            return buildHierarchy(events_afk, events_window);
        });
    }).then((hierarchy) => {
        console.log(hierarchy);
        this.hierarchy = hierarchy;
    });
  },
}
</script>
